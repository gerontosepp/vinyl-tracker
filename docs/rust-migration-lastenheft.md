# Lastenheft: Portierung des Vinyl Tracker Backends von Java/Spring Boot nach Rust

> **Dokumenten-Status:** Entwurf / Freigegeben für Umsetzung  
> **Projekt:** Vinyl Tracker Backend (Rust Migration)  
> **Ziel-Repository / Teilprojekt:** `vinyl-tracker-backend-rs`  
> **Referenz-Implementierung:** `vinyl-tracker-backend` (Java 25 / Spring Boot 4.x)  
> **Datum:** 2026-10-14  
> **Version:** 1.0.0  

---

## 1. Einleitung & Projektziele

### 1.1 Problemstellung & Ausgangslage
Das bisherige Backend von Vinyl Tracker basiert auf **Java 25** und **Spring Boot 4.x**. Es verwaltet Vinyl-Sammlungen, bindet die Discogs-API an, steuert Roon-Audiowiedergabe, generiert QR-Codes/PDFs und liefert REST-APIs für das Angular-Frontend sowie den integrierten Rust-MCP-Server.

Obwohl funktional vollständig und mit >80 % Testabdeckung abgesichert, weist die JVM-Laufzeit auf schlanken Home-Servern (z. B. Proxmox LXC-Container, Raspberry Pi 4/5, sparsame VPS) Nachteile auf:
- **Hoher Speicherbedarf:** Der Java-Prozess belegt im Docker-Container ca. **250–450 MB RAM**.
- **Lange Startzeit:** Kaltstart der JVM dauert **7–9 Sekunden**.
- **Große Container-Images:** Das Java-Laufzeit-Image wiegt ca. **350–400 MB**.
- **Technologie-Bruch:** Der MCP-Server (`mcp/`) ist bereits in Rust geschrieben; das Backend läuft jedoch in Java.

### 1.2 Projektziel
Neuentwicklung des Backends als eigenständiges, modernes **Rust-Projekt** mit dem Ziel:
1. **Speicherreduktion:** Idle-RAM unter **35 MB**, unter Volllast unter **60 MB**.
2. **Latenz & Startup:** Startzeit unter **50 ms**, minimale Request-Overheads ohne Garbage-Collection-Spikes.
3. **Kompaktes Deployment:** Multi-Arch Docker-Image unter **25 MB** (Scratch oder Alpine mit statisch gelinktem Binary).
4. **100 % API- und Datenbank-Kompatibilität:** Das Angular-Frontend sowie bestehende PostgreSQL-Datenbanken müssen **ohne Anpassung** weiterfunktionieren.

### 1.3 Nicht-Ziele (Out of Scope)
- Keine Änderungen am Angular-Frontend (HTML/TypeScript/Tailwind CSS bleiben unberührt).
- Keine Schema-Inkompatibilitäten zur bestehenden PostgreSQL-Datenbank (keine erzwungene Datenmigration von Altbeständen).
- Keine funktionalen Kürzungen (alle Features von Discogs-Sync über Roon bis PDF-Generierung müssen paritätisch vorhanden sein).

---

## 2. Ziel-Technologie-Stack & Systemarchitektur

### 2.1 Gewählte Rust-Bibliotheken (Crates)

| Komponente / Aufgabe | Rust-Crate | Begründung / Funktion |
| :--- | :--- | :--- |
| **Async Runtime** | `tokio = { version = "1", features = ["full"] }` | Standard-Laufzeit für asynchrone I/O in Rust |
| **Web-Framework** | `axum = "0.8"` / `tower`, `tower-http` | Modernes, performantes Framework; typsichere Extractor und Tower-Middleware |
| **Serialisierung** | `serde = { version = "1", features = ["derive"] }`, `serde_json` | JSON-Serialisierung/-Deserialisierung mit `snake_case` |
| **Datenbank & Migration** | `sqlx = { version = "0.8", features = ["postgres", "runtime-tokio-rustls", "chrono", "bigdecimal"] }` | Asynchroner Postgres-Pool, Compile-Time geprüfte Queries |
| **Migrationen** | `refinery = { version = "0.8", features = ["tokio-postgres"] }` | Ausführung bestehender Flyway-Migrationsdateien (`V1__...` bis `V9__...`) |
| **HTTP-Client** | `reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json"] }` | Discogs REST API & Image Proxy |
| **Caching** | `moka = { version = "0.12", features = ["future"] }` | Rust-Äquivalent zu Caffeine (TinyLFU Caching für Metadaten & Preise) |
| **Rate-Limiting** | `governor = "0.8"` | Thread-sicherer Rate-Limiter (60 Req/Min für Discogs API) |
| **Authentifizierung & JWT** | `jsonwebtoken = "9"`, `argon2 = "0.5"` (oder `bcrypt = "0.17"`) | JWT Validierung/Signierung und sicheres Passworthashing |
| **Token-Verschlüsselung** | `aes-gcm = "0.10"` | AES-256-GCM für Discogs Personal Access Tokens |
| **QR-Code & PDF** | `fast_qr = "0.12"`, `printpdf = "0.7"` | Generierung druckfähiger PDF-Etikettenbögen mit Vektor-QR-Codes |
| **Roon Integration** | `tokio-tungstenite = { version = "0.26", features = ["rustls-tls-native-roots"] }` | WebSocket-Client für Roons MOO-Protokoll |
| **Observability & Logging** | `tracing = "0.1"`, `tracing-subscriber = "0.3"` | Strukturiertes Logging mit Request-ID, Trace-Span und Performance-Timing |
| **Konfiguration** | `config = "0.15"`, `dotenvy = "0.15"` | Laden von Umgebungsvariablen und Default-Settings |

### 2.2 Systemkontext & Schnittstellen

```
                   +-----------------------------------+
                   |     Angular 19/20 Frontend        |
                   |      (Browser / Mobile PWA)       |
                   +-----------------+-----------------+
                                     |
                                     | HTTPS / JSON (REST)
                                     v
                   +-----------------+-----------------+
                   |       Vinyl Tracker Backend       |
                   |              (Rust)               |
                   +----+------------+------------+----+
                        |            |            |
         SQL / TCP 5432 |            | HTTPS      | WebSocket / UDP
                        v            v            v
     +------------------+--+   +-----+-----+   +--+--------+
     | PostgreSQL 16 DB    |   | Discogs   |   | Roon Core |
     | (Sammlung & Events) |   | REST API  |   | (Lokal)   |
     +---------------------+   +-----------+   +-----------+
```

---

## 3. Datenbank-Schema & Migrations-Kompatibilität

Das Rust-Backend muss auf bestehende Datenbanken aufsetzen können, ohne Tabellen neu zu initialisieren.

### 3.1 Migrationen (Flyway-Historie V1–V9)
Die Migrationen liegen unter `db/migration/` und müssen via `refinery` oder `sqlx` in der exakten Reihenfolge ausgeführt werden:
1. `V1__initial_schema.sql`: Tabellen `app_user`, `record_cache`, `collection_item`, `listen_event`.
2. `V2__add_indexes.sql`: Indizes für Performance (User-Lookups, Discogs-IDs, Scan-Timestamps).
3. `V3__add_lowest_price_to_record_cache.sql`: Spalte `lowest_price` in `record_cache`.
4. `V4__add_format_to_record_cache.sql`: Spalte `format` (VARCHAR 100) in `record_cache`.
5. `V5__drop_salt_from_app_user.sql`: Bereinigung des Password-Salts zugunsten von BCrypt/Argon2.
6. `V6__add_roon_settings_to_app_user.sql`: Spalten `roon_core_ip`, `roon_core_port`, `roon_zone_id`, `roon_zone_name`.
7. `V7__update_double_cd_formats.sql`: Daten-Update für Format-Bezeichnungen (`Double CD`).
8. `V8__add_conditions_to_collection_item.sql`: Spalten `media_condition`, `sleeve_condition`, `storage_location`.
9. `V9__add_median_price_to_record_cache.sql`: Spalte `median_price` in `record_cache`.

### 3.2 Kern-Tabellen & Felder

#### `app_user`
- `id` (BIGSERIAL PRIMARY KEY)
- `username` (VARCHAR(255) UNIQUE NOT NULL)
- `password` (VARCHAR(255) NOT NULL)
- `discogs_username` (VARCHAR(255))
- `discogs_token` (VARCHAR(512) - AES-GCM verschlüsselt)
- `created_at` (TIMESTAMP WITHOUT TIME ZONE NOT NULL UTC)
- `updated_at` (TIMESTAMP WITHOUT TIME ZONE NOT NULL UTC)
- `roon_core_ip`, `roon_core_port`, `roon_zone_id`, `roon_zone_name` (optional)

#### `record_cache`
- `id` (BIGSERIAL PRIMARY KEY)
- `discogs_id` (BIGINT UNIQUE NOT NULL)
- `title` (VARCHAR(500) NOT NULL)
- `artist` (VARCHAR(500) NOT NULL)
- `year` (INTEGER)
- `format` (VARCHAR(100))
- `genres` (TEXT[])
- `styles` (TEXT[])
- `thumb_url` (VARCHAR(1000))
- `cover_url` (VARCHAR(1000))
- `labels` (JSONB)
- `tracklist` (JSONB)
- `lowest_price` (NUMERIC(10, 2))
- `median_price` (NUMERIC(10, 2))
- `cached_at` (TIMESTAMP WITHOUT TIME ZONE NOT NULL UTC)

#### `collection_item`
- `id` (BIGSERIAL PRIMARY KEY)
- `user_id` (BIGINT REFERENCES app_user(id) ON DELETE CASCADE)
- `record_id` (BIGINT REFERENCES record_cache(id) ON DELETE CASCADE)
- `discogs_instance_id` (BIGINT)
- `folder_id` (INTEGER DEFAULT 1)
- `rating` (INTEGER DEFAULT 0)
- `notes` (TEXT)
- `media_condition` (VARCHAR(50))
- `sleeve_condition` (VARCHAR(50))
- `storage_location` (VARCHAR(100))
- `created_at` (TIMESTAMP WITHOUT TIME ZONE NOT NULL UTC)
- `updated_at` (TIMESTAMP WITHOUT TIME ZONE NOT NULL UTC)

#### `listen_event`
- `id` (BIGSERIAL PRIMARY KEY)
- `user_id` (BIGINT REFERENCES app_user(id) ON DELETE CASCADE)
- `record_id` (BIGINT REFERENCES record_cache(id) ON DELETE CASCADE)
- `listened_at` (TIMESTAMP WITHOUT TIME ZONE NOT NULL UTC)
- `source` (VARCHAR(50) NOT NULL - z. B. 'SCAN', 'MANUAL')
- `created_at` (TIMESTAMP WITHOUT TIME ZONE NOT NULL UTC)

---

## 4. Sicherheits-, Auth- & Krypto-Spezifikation

### 4.1 JWT (JSON Web Token)
- **Algorithmus:** HMAC-SHA256 (`HS256`).
- **Secret:** Konfigurierbar über `JWT_SECRET` (Default für Dev-Modus vorhanden, in Prod Pflicht).
- **Gültigkeitsdauer:** 7 Tage (604.800 Sekunden).
- **Claims:**
  - `sub`: Benutzername (`username`)
  - `iat`: Erstellungszeitpunkt (Unix Timestamp UTC)
  - `exp`: Ablaufzeitpunkt (Unix Timestamp UTC)
- **Header:** `Authorization: Bearer <TOKEN>`

### 4.2 Passwort-Hashing
- **Verfahren:** BCrypt (Cost Factor 10–12) oder Argon2id mit BCrypt-Verifikationskompatibilität für bestehende Benutzerpasswörter.

### 4.3 Discogs Token-Verschlüsselung (`TokenEncryptionService`)
- Discogs User-Tokens werden verschlüsselt in der Datenbank abgelegt.
- **Verfahren:** AES-256-GCM.
- **Key-Ableitung:** Aus Umgebungsvariable `ENCRYPTION_SECRET` (32 Bytes).
- **Format:** `Base64(IV [12 Bytes] + Ciphertext + Tag [16 Bytes])`.

### 4.4 CORS-Konfiguration
- Erlaubte Methoden: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`.
- Erlaubte Header: `Authorization`, `Content-Type`, `Accept`, `X-Requested-With`.
- Credentials: `true`.

---

## 5. Vollständiger REST-API Schnittstellenkatalog

Alle Endpunkte müssen exakt die bestehenden JSON-Felder (`snake_case`) und HTTP-Codes liefern. Bei Fehlern wird ein RFC 7807 `ProblemDetail` zurückgegeben (`{ "type": "about:blank", "title": "...", "status": 400, "detail": "...", "instance": "..." }`).

### 5.1 Authentifizierung & Benutzer (`/api/users`)

| Methode | Pfad | Auth | Beschreibung | Request Body / Query | Response DTO (200/201) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `POST` | `/api/users/register` | Nein | Neuer Benutzer | `{"username": "...", "password": "..."}` | `{"id": 1, "username": "...", "token": "JWT..."}` |
| `POST` | `/api/users/login` | Nein | Login mit Passwort | `{"username": "...", "password": "..."}` | `{"id": 1, "username": "...", "discogs_username": "...", "token": "JWT..."}` |
| `GET` | `/api/users/me` | Ja | Eigene Benutzerdaten | *keine* | `{"id": 1, "username": "...", "discogs_username": "...", "has_discogs_token": true, "roon_settings": {...}}` |
| `PUT` | `/api/users/me/discogs` | Ja | Discogs-Account verknüpfen | `{"discogs_username": "...", "token": "..."}` | Status 200 OK |
| `POST` | `/api/users/reset-password` | Nein | Passwort zurücksetzen | `{"username": "...", "new_password": "..."}` | Status 200 OK |
| `POST` | `/api/users/logout` | Nein/Ja | Logout (Client-seitig ungültig) | *keine* | Status 200 OK |

### 5.2 Sammlungsverwaltung (`/api/collection`)

| Methode | Pfad | Auth | Beschreibung | Request Body / Query | Response DTO |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `GET` | `/api/collection` | Ja | Sammlungs-Katalog mit Pagination, Sortierung und Multi-Filter | `page=1&per_page=50&sort=artist&sort_order=asc&category=all&genres=Rock,Jazz&years=1970-1979&search=...&not_played_since=...&unplayed_only=false` | `CollectionResponse` (Paginiertes Array mit `releases`, `pagination`, inkl. `median_price`, `last_played_at`, `play_count`) |
| `GET` | `/api/collection/random` | Ja | Zufällige Platte aus der Sammlung | `genre=Rock&unplayed_only=true` | `CollectionRelease` (Objekt) |
| `GET` | `/api/collection/unplayed` | Ja | Alben mit 0 Plays („Shelf of Shame“) | `page=1&per_page=50` | `CollectionResponse` |
| `POST` | `/api/collection/sync` | Ja | Vollständige Synchronisation mit Discogs | *keine* | `{"status": "SUCCESS", "synced_items": 142, "updated_prices": 28}` |
| `POST` | `/api/collection/releases/{id}` | Ja | Release aus Discogs zur Sammlung hinzufügen | *keine* | `CollectionItem` |
| `POST` | `/api/collection/prices/refresh` | Ja | Marktpreise für Sammlung aktualisieren | *keine* | `{"updated_count": 15, "failed_count": 0}` |
| `POST` | `/api/collection/qr-codes/selected` | Ja | PDF-Etiketten für ausgewählte Alben | `[123, 456, 789]` (Release-IDs) | `application/pdf` Stream |
| `GET` | `/api/collection/qr-codes/all` | Ja | PDF-Etiketten für die gesamte Sammlung | *keine* | `application/pdf` Stream |

### 5.3 Album-Details & Wiedergabe (`/api/records`)

| Methode | Pfad | Auth | Beschreibung | Request Body / Query | Response DTO |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `GET` | `/api/records/{id}` | Ja | Detailansicht (Tracklist, Labels, Notizen, Historie) | *keine* | `RecordDetailDto` |
| `POST` | `/api/records/{id}/listen` | Ja | „Höre ich gerade“ / Abspielvorgang erfassen | *keine* | `ListenEventDto` (Timestamp UTC) |
| `PATCH`| `/api/records/{id}/condition` | Ja | Zustände (Media, Sleeve) & Lagerort aktualisieren | `{"media_condition": "Near Mint (NM or M-)", "sleeve_condition": "Very Good Plus (VG+)", "storage_location": "Kallax A3"}` | Aktualisiertes `RecordDetailDto` (inkl. neu berechnetem `median_price` und Sync zu Discogs) |

### 5.4 Barcode- & QR-Scanning (`/api/scan`)

| Methode | Pfad | Auth | Beschreibung | Request Body / Query | Response DTO |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `POST` | `/api/scan` | Ja | Barcode oder Custom QR-Code verarbeiten | `{"barcode": "075678123428"}` | `{"success": true, "record": {...}, "discogs_matches": [...]}` |
| `DELETE`| `/api/scan/{id}` | Ja | Einzelnen Abspiel-Eintrag löschen | *keine* | Status 204 No Content |
| `DELETE`| `/api/scan/all` | Ja | Gesamte Abspiel-Historie zurücksetzen | *keine* | Status 204 No Content |

### 5.5 Dashboard & Statistiken (`/api/analytics`)

| Methode | Pfad | Auth | Beschreibung | Response Format |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/analytics/recent` | Ja | Kürzlich gespielte Alben | Array von `RecentListenDto` |
| `GET` | `/api/analytics/top` | Ja | Meistgespielte Alben im Zeitraum | `startDate=2026-10-01&endDate=2026-10-14` -> Array von `TopRecordDto` |
| `GET` | `/api/analytics/collection/value` | Ja | Discogs-Sammlungswert in EUR (`curr_abbr=EUR`) | `{"minimum": {"currency": "EUR", "value": 6405.0}, "median": {"currency": "EUR", "value": 11973.16}, "maximum": {"currency": "EUR", "value": 23112.0}}` |
| `GET` | `/api/analytics/collection/genres`| Ja | Genre-Verteilung der Sammlung | `[{"name": "Rock", "value": 120}, {"name": "Jazz", "value": 45}]` |

### 5.6 Discogs & Bild-Proxy

| Methode | Pfad | Auth | Beschreibung | Response Format |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/discogs/search` | Ja | Globale Discogs-Suche | `query=Pink+Floyd` -> Discogs Search Results |
| `GET` | `/api/proxy/image` | Nein | SSRF-validierter Bild-Proxy für Cover-Art | `url=https://i.discogs.com/...` -> Bildstream mit Cache-Headern |

### 5.7 Roon Audiowiedergabe (`/api/roon`)

| Methode | Pfad | Auth | Beschreibung | Response Format |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/roon/status` | Ja | Verbindungsstatus zum Roon Core | `{"connected": true, "core_name": "Roon Nucleus", "paired": true}` |
| `GET` | `/api/roon/zones` | Ja | Verfügbare Audio-Zonen | Array von `{"zone_id": "...", "display_name": "Wohnzimmer", "state": "playing"}` |
| `POST` | `/api/roon/settings` | Ja | Standard-Zone speichern | `{"zone_id": "...", "zone_name": "Wohnzimmer"}` |
| `POST` | `/api/roon/play` | Ja | Album auf Roon wiedergeben | `{"record_id": 123}` -> Matcht Albumtitel/Artist in Roon Bibliothek und startet Playback |

---

## 6. Fachliche Kernlogik & Implementierungsdetails

### 6.1 Format-Erkennung (`determine_format`)
Die Discogs-API liefert Format-Beschreibungen oft unstrukturiert (z. B. `["Vinyl", "LP", "Album"]` oder `["Vinyl", "2", "LP"]`).
Die Rust-Funktion muss folgende Regeln abbilden:
1. `qty >= 2` oder Descriptions mit `2xLP`, `Double LP`, `Gatefold` ➔ **`Double LP`**.
2. Standard Vinyl mit `LP` oder `Album` ➔ **`LP`**.
3. `CD` mit `qty >= 2` oder `2xCD`, `Double CD` ➔ **`Double CD`**.
4. Standard `CD` oder `CDr` ➔ **`CD`**.
5. Default / Fallback: **`LP`**.

### 6.2 Preisfindung & Medienzustände (Goldmine Grading)
Wird der Plattenzustand (`media_condition`) geändert, muss der geschätzte Medianpreis automatisch aktualisiert werden:
1. Aufruf Discogs Marketplace Price Suggestions: `GET /marketplace/price_suggestions/{release_id}`.
2. Mapping auf den exakten Goldmine-Zustand (`Mint (M)`, `Near Mint (NM or M-)`, `Very Good Plus (VG+)`, `Very Good (VG)`, `Good Plus (G+)`, etc.).
3. Ist der genaue Zustand nicht vorhanden, Fallback auf `Very Good Plus (VG+)` oder den Median über alle Suggestions.
4. Aktualisierung von `record_cache.median_price`.
5. Asynchrones Zurückschreiben in das Discogs Custom Field via `POST /users/{username}/collection/folders/0/releases/{release_id}/instances/{instance_id}/fields/{field_id}`.

### 6.3 Barcode-Scanning & Deutscher Tastatur-Bugfix
Scanner-Handgeräte verhalten sich oft wie USB-Tastaturen mit deutschem Layout (Vertauschung von `Z` und `Y`, Sonderzeichen).
- Der Scan-Service muss automatische Zeichenersetzungen vornehmen (z. B. für Barcodes mit führenden Ziffern/Prüfziffern).
- Custom QR-Codes haben das Format `VT:<discogs_id>` (z. B. `VT:123456`). Erkennt der Scanner `VT:`, wird direkt die `discogs_id` extrahiert.

### 6.4 SSRF-geschützter Bild-Proxy
Um Discogs-Bilder ohne CORS-Probleme und ohne Weitergabe von API-Tokens anzuzeigen:
- Nur URLs von erlaubten Domains zulassen: `*.discogs.com`, `*.discogs.net`, `i.discogs.com`.
- Private IP-Bereiche (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`) müssen zwingend blockiert werden (SSRF-Schutz).
- HTTP-Cache-Header (`Cache-Control: public, max-age=86400`) setzen.

---

## 7. Projektstruktur des neuen Rust-Repositories

Empfohlene Workspace-Struktur für `vinyl-tracker-backend-rs`:

```
vinyl-tracker-backend-rs/
├── Cargo.toml
├── Cargo.lock
├── Dockerfile
├── .env.example
├── migrations/                     # 1:1 Kopie der Flyway V1-V9 SQL-Skripte
│   ├── V1__initial_schema.sql
│   ├── ...
│   └── V9__add_median_price_to_record_cache.sql
├── src/
│   ├── main.rs                     # Entrypoint & Axum Server Start
│   ├── config.rs                   # App-Config (DB-URL, JWT, Secrets)
│   ├── error.rs                    # AppError & ProblemDetail RFC 7807
│   ├── state.rs                    # AppState (DB-Pool, Reqwest-Client, Caches)
│   ├── auth/                       # JWT, Password-Hashing, Auth-Extractors
│   │   ├── jwt.rs
│   │   └── middleware.rs
│   ├── db/                         # PostgreSQL Connection & Helpers
│   │   ├── mod.rs
│   │   └── migrations.rs
│   ├── models/                     # DTOs & DB-Entitäten
│   │   ├── user.rs
│   │   ├── record.rs
│   │   ├── collection.rs
│   │   ├── discogs.rs
│   │   ├── analytics.rs
│   │   └── roon.rs
│   ├── clients/                    # Externe API-Clients
│   │   ├── discogs.rs              # Discogs REST Client mit Rate-Limit & Moka Cache
│   │   └── roon.rs                 # Roon WebSocket MOO-Client
│   ├── services/                   # Business-Logik
│   │   ├── user_service.rs
│   │   ├── collection_service.rs
│   │   ├── query_service.rs        # Paginierung, Multi-Filter, Genres, Dekaden
│   │   ├── scan_service.rs
│   │   ├── analytics_service.rs
│   │   ├── pdf_service.rs          # PDF-Etiketten & QR-Code-Rendering
│   │   └── crypto_service.rs       # AES-GCM Token-Verschlüsselung
│   └── routes/                     # Axum HTTP-Router & Handler
│       ├── mod.rs
│       ├── users.rs
│       ├── collection.rs
│       ├── records.rs
│       ├── scan.rs
│       ├── analytics.rs
│       ├── roon.rs
│       └── proxy.rs
└── tests/                          # Integrationstests mit Testcontainers
    ├── auth_tests.rs
    ├── collection_tests.rs
    └── scan_tests.rs
```

---

## 8. Abnahmekriterien & Qualitätssicherung

1. **Funktionale Parität:**
   - Alle 210 Frontend-Unit-Tests und Playwright-E2E-Tests müssen gegen das Rust-Backend erfolgreich durchlaufen.
   - Manuelle Stichproben: Login, Discogs-Sync, Barcode-Scan, Filterung (z. B. Genre „Rock“ + Dekade „1970er“), PDF-Generierung, Roon-Status.
2. **Performance- & Ressourcen-Ziele:**
   - Kaltstart im Docker-Container: **< 100 ms** (inkl. Datenbank-Pool-Init).
   - Arbeitsspeicher (Resident Set Size): **< 35 MB** im Leerlauf, **< 65 MB** bei laufendem Sammlungs-Sync.
   - Container-Image: **< 30 MB** als Alpine/Scratch Multi-Arch-Build.
3. **Daten-Sicherheit:**
   - 100 % Kompatibilität zu bestehenden Passwörtern und verschlüsselten Discogs-Tokens in der PostgreSQL-Datenbank.
