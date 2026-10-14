# Release-Info

Übersicht der Änderungen und Meilensteine des Projekts **Vinyl Tracker**.

> [!NOTE]
> Mit Version **v0.2.1** wurde das Versionsschema re-baselined (vorherige Versionen trugen historisch `v1.x` / `v2.x`-Bezeichnungen), um den Work-in-Progress (WiP) / Beta-Charakter des Projekts klar zu kennzeichnen. Frühere Versionen sind hier chronologisch in konsistente Meilensteine zusammengefasst.

---

## Unreleased

- **DevOps / Runner-Tooling: Dozzle SSH-Tunnel & Launcher Script (`scripts/open_dozzle.sh`)**:
  - Ermöglicht den schnellen Verbindungsaufbau zum Dozzle Log-Viewer auf dem CI-Runner-Server (`root@2.31.34.79:8888`).
  - Öffnet das Dashboard automatisch in einem separaten, minimalistischen Browser-Fenster im App-Modus (Chrome/Brave/Edge `--app`).
  - Verhindert Port-Kollisionen bei bereits aktiven Verbindungen und bietet `--stop`- bzw. `--restart`-Optionen.

---

## v0.6.1 (2026-10-14) – Aktueller Release (WiP / Beta)

- **Fix: Erhöhung der Proxy-Timeouts & Fail-Fast bei Discogs-Sync**:
  - Setzt `proxy_connect_timeout 60s`, `proxy_send_timeout 300s` und `proxy_read_timeout 300s` im internen Frontend-Nginx zur Vermeidung von 504 Gateway Timeouts bei umfangreichen Sammlungs-Synchronisationen.
  - Konfiguriert explizite HTTP-Timeouts (10s Connect, 25s Read) für Spring `RestClient` und reduziert den Discogs RateLimiter `timeoutDuration` auf 10s, sodass Album-Detailabfragen während laufender Sync-Vorgänge sofort auf lokale Datenbank-Einträge zurückgreifen statt zu blockieren.
  - Ergänzt `crossorigin="use-credentials"` am Web-Manifest-Link in `index.html` zur Vermeidung von 401-Fehlern hinter Nginx Proxy Manager Access Lists.
- **Fix: Deaktivierung von OCI Provenance Attestations im Docker-Build**:
  - Setzt `provenance: false` in `.github/workflows/ci.yml` für Multi-Arch Builds (`linux/amd64`, `linux/arm64`), um `content at https://ghcr.io/.../manifests/sha256:... not found`-Fehler beim Docker-Pull von GHCR zuverlässig zu verhindern.

---

## v0.6.0 (2026-10-14)

- **Fix: Singleton-Container-Lifecycle für Integrationstests**:
  - Behebt Verbindungsabbrüche (`Connection refused`) in der CI-Pipeline durch statische Initialisierung des PostgreSQL-Containers in `AbstractIntegrationTest`, sodass Spring Boot den gecachten ApplicationContext über die gesamte Testsuite hinweg verlässlich weiterverwenden kann.
- **Dependency-Aktualisierungen (Backend & Frontend)**:
  - Backend: Upgrade PostgreSQL Driver (`42.7.13` → `42.7.14`), OpenPDF (`2.0.3` → `2.2.2`), SpringDoc OpenAPI UI (`2.8.5` → `2.8.6`).
  - Frontend: Upgrade `@lucide/angular` (`1.51.0` → `1.56.0`), `@playwright/test` (`1.63.0` → `1.64.0`), `postcss` (`8.5.28` → `8.5.30`) sowie Aktualisierung transitiver Pakete via `npm update`.
- **Sammlungsfilter: „Nicht gespielt seit <Datum>“ und „Noch nie gespielt“ (`#61`)**:
  - Neuer Datumsfilter in der Sammlungsansicht (`not_played_since = YYYY-MM-DD`), der Alben anzeigt, die seit dem gewählten Stichtag nicht mehr oder noch nie gehört wurden.
  - Checkbox-Schnellfilter „Noch nie gespielt“ (`unplayed_only = true`), der ausschließlich Alben mit 0 Plays anzeigt.
  - Serverseitige Filterung direkt in JPQL (`CollectionItemRepository`) inklusive konsistenter Paginierung und Zählung.
  - Neues Dropdown-Menü in der `CollectionToolbarComponent` inklusive Datums-Picker, Löschen-Button und aktiver Filter-Badges mit gegenseitigem Ausschluss zu „Nur Gespielte“.
- **Discogs Zustands-Synchronisation (Media & Sleeve Condition) (`#62`)**:
  - Automatischer Import der Goldmine-Grading-Zustände (*Media Condition* und *Sleeve Condition*) aus den benutzerdefinierten Feldern der Discogs-Sammlung (`GET /users/{username}/collection/fields`).
  - Persistierung der Zustände in `collection_item` via Flyway-Migration `V8__add_conditions_to_collection_item.sql`.
  - Anzeige der Zustände im Record-Detail-Modal mit dedizierten Farb-Karten und Goldmine-Kurzcodes (`VG+`, `NM`, `VG` etc.).
  - Anzeige kompakter Zustand-Badges in der Sammlungstabelle (neue Spalte „Zustand“) sowie in den Kacheln der Sammlungsübersicht.
  - Grundlage für zustandsbasierte Discogs-Marktpreis-Ermittlung (`#30`).
- **Zustandsbasierte Discogs-Marktpreis-Ermittlung (`#30`)**:
  - Automatische Ermittlung geschätzter Marktpreise in EUR über die Discogs Marketplace Price Suggestions API (`GET /marketplace/price_suggestions/{release_id}`) basierend auf dem Plattenzustand (Media Condition aus `#62`, Fallback auf `Very Good Plus (VG+)`).
  - Persistierung des geschätzten Werts in `record_cache.median_price` via Flyway-Migration `V9__add_median_price_to_record_cache.sql`.
  - Automatisches Nachladen beim Öffnen von Album-Details, Scannen von Barcodes sowie Möglichkeit zur Massen-Aktualisierung (`POST /api/collection/prices/refresh`).
  - Anzeige des geschätzten Werts im Album-Detail-Modal („Geschätzter Wert“), in der Sammlungstabelle (Spalte „Wert“) und als Badge in den Album-Karten.
  - Entfall der obsoleten Mindestpreis-Anzeige zugunsten einer aufgeräumten 4-Spalten-Statistikleiste.
- **Fix: Lokale Zeitzonen-Konvertierung für Hör-Events (`#64`)**:
  - Konsequente ISO-8601 UTC-Serialisierung (`yyyy-MM-dd'T'HH:mm:ss'Z'`) über Spring `JacksonConfig` und DTO `@JsonFormat`-Definitionen.
  - Automatisches UTC-Parsing in Angular `LocalizedDatePipe` zur verlässlichen Umrechnung in die lokale Browser-Zeitzone.
- **Fix: Filterung von min_plays direkt in SQL-Queries (`#60`)**:
  - Direkte Ausführung des `min_plays`-Filters in JPQL (`COUNT(le) >= :minPlays`) zur Behebung von Paginierungs- und Gesamtzahl-Fehlern in der Sammlung bei aktivem „Nur Gespielte“-Filter.
- **Sammlungstabelle: Spalte „Zuletzt gespielt“ (Last played at) (`#70`)**:
  - Ergänzung der Spalte „Last played at“ direkt nach „Plays“ mit formatiertem Timestamp des letzten Abspielvorgangs (`LocalizedDatePipe`).
- **Fix: Automatisches Handling abgelaufener JWT-Sessions (`#57`)**:
  - Fängt `401 Unauthorized` und `403 Forbidden` im `authInterceptor` ab, leert Session und Token (`vinyl_auth_token`), zeigt einen erklärenden Toast-Hinweis und leitet zuverlässig auf `/login` weiter (unter Ausschluss öffentlicher Auth-Endpunkte).
- **Dashboard: Entfernung redundanter „Gescannt:“-Badges (`#59`)**:
  - Entfernung des unvollständigen Hover-Overlay-Badges („Gescannt:“) über Album-Covern in der Sektion „Kürzlich Gehört“ zugunsten einer ungestörten Cover-Darstellung und der bereits vorhandenen Datumsanzeige am unteren Kartenrand.
  - Bereinigung der ungenutzten Übersetzungsschlüssel `dashboard.scannedLabel` in `LanguageService`.

---

## v0.5.0 (2026-10-12)

- **Eyoyo EY-009P & Hardware-Scanner Integration (`#45`, `#49`)**:
  - Globaler HID Keyboard Wedge Listener im Frontend (`ScannerService`) zur vollautomatischen Erkennung von Barcode- und QR-Code-Scannern ohne Fokusverlust oder manuelle Eingabefelder.
  - Drei Betriebsmodi in den Einstellungen wählbar: *Externer Hardware-Scanner*, *Interner Kamera-Scanner* und *Hybrid-Modus*.
  - Kamera bleibt im Hardware-Modus deaktiviert (spart Akku und vermeidet Browser-Kameradialoge).
  - Akustisches Feedback (Beep) und dedizierter Scanner-Live-Testbereich in den Einstellungen.
- **QR-Code-Auswahl: Auswahl aufheben (`#38`, `#54`)**:
  - Neuer Button „Auswahl aufheben“ (Clear Selection) in der Sammlungs-Toolbar zum schnellen Abwählen aller markierten Datensätze.
- **Sammlungstabelle: Feinjustierung der Klick-Aktionen (`#52`, `#53`)**:
  - Intuitive Interaktion je Spalte:
    - Spalte 1: Checkbox zur Auswahl für den QR-Code-Druck.
    - Spalten 2, 4, 5 (Cover, Titel, Artist): Öffnet das umfassende Record-Details-Modal.
    - Spalten 3, 6, 7, 8 (Format, Jahr, Hinzugefügt am, Hören-Button): Neutrale Spalten ohne Modal-Trigger.
    - Spalte 9: Direkter Discogs-Link zur Release-Seite im neuen Tab.
- **Dynamische Sprach- und Datumsformatierung (`#37`, `#51`)**:
  - Einführung der `LocalizedDatePipe` mit dynamischer Angular `LOCALE_ID`-Umschaltung (`de-DE` / `en-US`).
  - Datumsanzeigen wie „Hinzugefügt am“ passen sich sofort und nahtlos an die in der UI ausgewählte Sprache an.
- **UI & Navigation Harmonisierung (`#35`, `#50`)**:
  - Scan-Button in der Desktop-Sidebar an das einheitliche Styling und Farbschema der Hauptnavigation angepasst.

---

## v0.4.0 (2026-10-09) – Vorgänger-Release (WiP / Beta)

- **Roon Control API Integration (`#44`)**:
  - Direkte Steuerung & Wiedergabe von Alben auf Roon Cores und Zonen direkt aus Vinyl Tracker.
  - Zonenauswahl mit Speicherung der bevorzugten Roon-Zone in den Benutzereinstellungen.
  - Direkte Wiedergabe-Aktionen ("Auf Roon abspielen") und "Höre ich gerade" im Album-Detail-Modal.
- **Erweiterte Sammlungsfilter (`#47`)**:
  - **Genre-Filter**: Dropdown mit Suchfeld und Mehrfachauswahl basierend auf der tatsächlichen Genre-Verteilung der Sammlung.
  - **Jahres-Filter**: Flexibles Parsen von Einzeljahren und Zeitspannen (z.B. `1970-1972, 1975`).
  - **Kategorie-Filter & Zähler**: Segmentierte Steuerung (`Alle` / `Platten` / `CDs`) mit Anzeige der jeweiligen Trefferanzahl in Badges.
- **Doppel-CD & Multi-Format-Support (`#46`)**:
  - Korrektur der Format-Klassifizierung in `DiscogsDto.determineFormat`: Doppel- und Multi-CDs (`2xCD`, `qty >= 2`) werden nicht mehr fälschlicherweise als `Double LP` eingestuft.
  - Flyway-Migration `V7__update_double_cd_formats.sql` zur automatischen Bereinigung bestehender Datenbankeinträge in `record_cache`.
  - Dedizierte Frontend-Darstellung (`double_cd`) mit cyanfarbenen Discs und kompaktem `2CD`-Badge sowie Tooltips auf Deutsch und Englisch.
- **Dashboard & UX-Optimierungen**:
  - Standardfilter für die Hör-Aktivität auf 7 Tage gesetzt mit zusätzlichem 7-Tage-Schnellfilter (`#40`).
  - Vollständige Anzeige aller Genres in der Legende des Genre-Breakdowns (`#31`).
  - Verlagerung des Gesamtdownloads aller QR-Codes in die Einstellungen (`#33`).
  - Mobile Optimierung: Ausblenden der QR-Druck-Buttons auf mobilen Geräten (`#36`).

---

## v0.3.1 (2026-10-07) – Vorgänger-Release (WiP / Beta)

- **Proxmox & Reverse Proxy / DynDNS Stabilität**:
  - **CORS- & Auth-Umgebungsvariablen in Docker Compose**: Explizite Weiterleitung von `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_CREDENTIALS`, `AUTH_COOKIE_*`, `IMAGE_PROXY_ALLOWED_HOSTS` und `AUTH_RATE_LIMIT_FOR_PERIOD` an den `backend`-Container in `docker-compose.registry.yml` und `docker-compose.prod.yml`. Behebt `403 Invalid CORS request` Fehler bei Zugriffen über DynDNS- und Reverse-Proxy-Domains (z.B. IPv64.net / Nginx Proxy Manager).
  - **Robustes Deployment-Skript (`deploy_proxmox.sh`)**:
    - Erzeugung kollisionsfreier Hex-Secrets (`openssl rand -hex`) und Pipe-Delimiter in `sed` gegen Syntaxfehler durch Sonderzeichen in Passwörtern/Salts.
    - Explizite Übergabe von `--env-file .env` an alle `docker compose`-Befehle zur Vermeidung leerer Umgebungsvariablen.
    - Automatische Erkennung und Warnhinweis für `CORS_ALLOWED_ORIGINS` bei Verwendung benutzerdefinierter Domains.
  - **Deployment-Dokumentation (`DEPLOYMENT.md`)**: Ergänzung der CORS-Konfigurationsschritte im Reverse-Proxy-Kapitel.
- **CI/CD & Release Automatisierung**:
  - **Multi-Plattform MCP Server Release Binaries**: Integration des Rust-MCP-Server-Matrix-Builds (`linux-x86_64` und `macos-aarch64`) in den GitHub Actions Auto-Release-Workflow (`release.yml`) mit automatischem Asset-Upload.
  - **Multi-Runner Support**: Vorbereitung und Dokumentation paralleler CI-Runner-Container auf Proxmox (`docker-compose.runner.yml`).

---

## v0.3.0 (2026-10-07) – Vorgänger-Release (WiP / Beta)

- **Barcode-Scanning & Discogs-Integration Enhancements**:
  - **Manuelle Suche & Barcode-Korrektur**: Neue Eingabemöglichkeit für Barcode-Ziffern und Albumtitel direkt in der Scanner-Ansicht sowie im Fehlermeldungs-Dialog bei nicht erkannten Platten.
  - **Unbekannte Platten zur Sammlung hinzufügen**: Automatische Erkennung noch nicht in der eigenen Sammlung vorhandener Alben bei Barcode-Scans inklusive Trefferauswahl und 1-Klick-Import in die Discogs-Sammlung.
  - **Intelligente Barcode-Normalisierung & Fallbacks**: `ScanService` bereinigt Barcodes (Whitespace), testet EAN-13/UPC-A Konvertierungen (führende 0) und nutzt automatische Volltextsuche als Fallback.
  - **Robuste Discogs-Bestandsprüfung**: Korrektur der Discogs-API-Prüfung (`isReleaseInCollection`) bei leeren Responses sowie vorgelagerte Prüfung der lokalen Datenbank via `CollectionItemRepository`.
  - **API-Statusbereinigung**: `ScanController` liefert `200 OK` mit Trefferliste, wenn Alben gefunden wurden, die noch nicht in der Nutzersammlung sind.
- **Frontend Navigation & Scanner UX**:
  - **Freie Hauptmenü-Navigation bei aktivem Scan**: Das Scanner-Overlay blockiert nicht mehr das App-Menü. Klicks auf Navigationselemente (Sidebar, Bottom Navigation, Top Bar) oder URL-Wechsel schließen den Scanner automatisch und sauber.
  - **Scanner-Toggle & Indikator**: Der Scan-Button in der Navigation agiert nun als Toggle mit visuellem Aktivitätsstatus.
  - **Automatischer Dashboard-Refresh**: Nach erfolgreichem Scan oder Import aktualisieren sich die Dashboard-Listen ("Zuletzt gehört", "Meistgespielt") ohne manuellen Reload.
- **Backend Analytics Stabilität & DTO-Entkopplung**:
  - **LazyInitializationException behoben**: Einführung von `ListenEventDto` und `@Transactional(readOnly = true)` auf `AnalyticsService` zur Entkopplung der JPA-Entities.
  - **Resilientes Dashboard-Laden**: Absicherung der parallelen API-Aufrufe im Frontend via `catchError` und Fallbacks.
- **CI/CD & Self-Hosted Proxmox Runner**:
  - Migration der GitHub Actions CI-Pipeline auf Self-Hosted Linux Runner (Proxmox LXC/VM).
  - Dedizierte Actions für `setup-chrome` und `setup-maven` zur zuverlässigen Ausführung von Karma-, Playwright-, Maven- und Rust-MCP-Testsuiten.
- **Entwicklungs- & Build-Umgebung**:
  - Konfiguration für Java 25 mit ByteBuddy Experimental Flag (`-Dnet.bytebuddy.experimental=true`), Mockito Subclass-Maker sowie JEnv- und SDKMAN-Projektdateien (`.java-version`, `.sdkmanrc`).

---

## v0.2.1 (2026-10-05) – Vorgänger-Release (WiP / Beta)

- **Version Re-Baseline & Deployment**:
  - Reset des Versionsschemas auf `0.2.1` zur Verdeutlichung des Work-in-Progress (WiP) / Beta-Charakters des Projekts.
  - Bereitstellung der Docker-Images als öffentliche Packages (**Public**) in der GitHub Container Registry (`ghcr.io/gerontosepp/vinyl-tracker-backend:0.2.1` & `frontend`) ohne Authentifizierungsanforderung.
  - Aufräumen der Repository-Wurzel: Shell-Skripte nach `scripts/`, alternative Docker-Compose-Dateien nach `docker/`, GitHub-Sicherheitsrichtlinie nach `.github/` und AI-Guidelines nach `docs/`.
  - Absicherung des `main`-Branches via GitHub Branch Protection (Pushes nur via Pull Requests).
  - Volle Synchronisation aller Frontend-, Backend- und Deployment-Konfigurationen auf Version 0.2.1.
- **Neue Backend REST-APIs & MCP-Tools**:
  - `GET /api/collection/random` & MCP-Tool `get_random_record`: Liefert zufällige Empfehlungen aus der Vinyl-Sammlung mit optionalem Genre-Filter und "Nur ungespielte Platten"-Modus.
  - `GET /api/collection/unplayed` & MCP-Tool `get_unplayed_records`: Paginierte Liste ungespielter Alben der Sammlung ("Shelf of Shame").
  - `GET /api/records/{id}` & MCP-Tool `get_record_details`: Umfassende Album-Details inklusive Tracklist, Release-Formate, Labels, Notizen und persönlicher Abspielhistorie.
  - `GET /api/discogs/search` & MCP-Tool `search_discogs`: Globale Discogs-Datenbanksuche nach Alben, Künstlern und Releases.
- **Format-Anzeige & Icons in der Plattenliste**:
  - Neue Spalte "Format" mit Icons für CD (`LucideDiscAlbum`), LP (`LucideDisc`) und Double LP (`2xLP`).
  - Automatische Format-Erkennung aus Discogs-Metadaten (`basic_information.formats`) mit Fallback auf Standard-LP.
  - Persistierung des Media-Formats in `record_cache` via Flyway-Migration `V4__add_format_to_record_cache.sql`.
  - Responsive Darstellung auf Desktop- und Mobilansicht inklusive interaktiver Hover-Tooltips für die Formatbeschreibungen (`LP (Vinyl)`, `Double LP (2xLP)`, `CD (Compact Disc)`).
  - Neue Sortieroption "Format, Künstler, Jahr" (`sort=format`) in Frontend und Backend.
- **Security & Authentifizierung**:
  - Per-IP Rate Limiting (Resilience4j) für alle öffentlichen Authentifizierungsendpunkte (`/api/users/login`, `/api/users/register`, `/api/users/reset-password`) mit konfigurierbarem Limit (`AUTH_RATE_LIMIT_FOR_PERIOD`, Standard: 10 Anfragen/Minute) und HTTP 429 `ProblemDetail`-Fehlerantworten.
  - Verschärfte Passwort-Policy: Erhöhung der Mindestpasswortlänge von 6 auf 8 Zeichen in DTOs und Frontend-Formularen.
  - Bereinigung des Authentifizierungsmodells: Überflüssiges separates `salt`-Feld aus `app_user` und `AppUser`-Entity entfernt (Flyway `V5__drop_salt_from_app_user.sql`), da BCrypt das Salt bereits selbst generiert und im Hash ablegt.
- **API-Validierung & Exception-Handling**:
  - `PdfGenerationException` (HTTP 500) eingeführt; generische `RuntimeException` und `IOException` in Controllern und Services vollständig entfernt.
  - `@Valid`-Absicherung für `POST /api/collection/qr-codes/selected` mit `@NotEmpty`, `@NotNull` und `@NotBlank` auf `QrCodeRequest` und `QrCodeItem`.
- **Frontend-Architektur & Wartbarkeit**:
  - Modulare Aufteilung der monolithischen `CollectionComponent` (von 1.374 auf 312 Zeilen) in fokussierte Standalone-Komponenten (`CollectionToolbarComponent`, `CollectionTableComponent`, `CollectionCardListComponent`, `RecordDetailModalComponent`, `FormatBadgeComponent`).
  - Auslagerung der HTML-Templates in separate, syntax-validierte `.html`-Dateien.
  - Reines Hilfsmodul `format-type.util.ts` für deterministische Formattyp-Erkennung.
  - Entfernung des veralteten Prototyp-Ordners `frontend_react/` und Bereinigung der `.gitignore`.
- **Test-Qualität & CI/CD-Pipelines**:
  - Frontend-Coverage-Erzwingung via `karma.conf.js` mit striktem globalen Schwellwert von > 80 % (Statements, Lines, Branches, Functions).
  - Ausführung von 12 Playwright E2E-Tests in der GitHub Actions CI-Pipeline (`ci.yml`) mit automatischem Browser-Setup und robuster Toast-Locator-Behandlung.
  - Automatisierte Generierung von Entwicklungs-SSL-Zertifikaten (`ensure-certs.js`) für `ng serve`, um ENOENT-Fehler in frischen CI- und Headless-Testumgebungen zu verhindern.
  - GitHub Actions Workflow auf Node 24 vereinheitlicht (`setup-node` und `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`).
  - 146 Backend-Tests mit JaCoCo-Mindestabdeckung (> 80 %) und 64 Frontend-Unit-Tests erfolgreich.
- **Rust MCP Server Erweiterung**:
  - Werkzeugsatz auf 14 native Tools erweitert mit vollständiger Typisierung, DTO-Mapping und Unittests.

---

## v0.2.0 (2026-10-02) – Model Context Protocol (MCP) Server

*(Historische Git-Tags: `v2.3.0` – `v2.4.0`)*

- **Model Context Protocol (MCP) Server (Rust)**:
  - Neuer, hochperformanter MCP-Server in Rust unter `mcp/` basierend auf dem offiziellen `rmcp` SDK (v3.5) und `tokio`.
  - 10+ native MCP-Tools zur Steuerung über KI-Assistenten (Antigravity IDE, Claude Desktop, Cursor): Sammlung abfragen (`get_user_collection`), Discogs-Synchronisation (`sync_collection`), Barcode-/QR-Code-Scans protokollieren (`scan_barcode`), Hördurchgänge verwalten/löschen (`delete_scan`, `reset_all_listens`), Analytics & Top-Alben (`get_recent_listens`, `get_top_records`, `get_collection_value`, `get_genre_breakdown`) sowie Benutzerprofil (`get_current_user`).
  - REST-Client-Architektur mit automatischem Backend-Login (`/api/users/login`), dynamischem Cookie-Lifecycle-Management (`vinyl_token`) und flexibler Casing-Unterstützung (Snake- & CamelCase).
  - Umfassende Unit-Test-Suite für DTOs, Serialisierung und Router-Registrierung (`cargo test`).
- **CI/CD & Multi-Plattform-Releases**:
  - Neuer `mcp-build`-Job in der GitHub Actions CI-Pipeline (`.github/workflows/ci.yml`).
  - Automatisierte Release-Verpackung: Vorkompilierte Binärdateien für Linux (`linux-x86_64`) und macOS (`macos-aarch64` Apple Silicon) werden bei jedem Release automatisch als Assets hochgeladen.
- **Workspace Skills**:
  - Standardisierte AI-Agent-Skills unter `.agent/skills/` integriert (`release-management`, `dependency-updates`, `database-migrations`, `proxmox-deployment`).
- **Dokumentation**:
  - Detaillierte Installations-, Konfigurations- und Nutzungsanleitung in `mcp/README.md`.
  - Aktualisierung von `README.md` und der Architektur-Dokumentation `docs/arc42.md`.

---

## v0.1.0 (2026-07-15) – Angular 19 & Spring Boot 4 Plattform

*(Historische Git-Tags: `v2.0.0` – `v2.2.0`)*

- **Frontend-Neuentwicklung (Angular 19)**:
  - Vollständige Migration des Frontends von React auf **Angular 19** mit Standalone Components, reactive State Management via Angular Signals und Tailwind CSS v4.
  - Progressive Web App (PWA) Support für mobile Endgeräte inklusive Service Worker und Offline-Asset-Caching.
  - Barcode- und QR-Code-Scanning über die HTML5 Camera API (`html5-qrcode`) im Secure Context (HTTPS).
  - Umfassende Jasmine/Karma-Unittests (> 90 % Coverage).
- **Backend-Architektur (Spring Boot 4 / Java 25)**:
  - Layered Architecture (Controller, Service, Repository) mit Java 25 LTS und Spring Boot 4.x.
  - Relationale Datenpersistenz mit PostgreSQL 16 und Flyway Schema-Migrationen.
  - Discogs-API-Integration mit serverseitiger Verschlüsselung sensibler Tokens via AES/PBKDF2.
  - OpenAPI 3 / Swagger-UI Dokumentation (`springdoc-openapi`).
  - Image-Proxy zur Umgehung von CORS-/Hotlinking-Restriktionen bei Album-Covern (`/api/proxy/image`).
  - QR-Code- und PDF-Generierung für physische Plattenbeschriftung.
  - Umfangreiche Unit- und Integrationstest-Suite (Surefire, Failsafe, Testcontainers).
- **DevOps & Containerisierung**:
  - Docker-Compose-Setups für Entwicklung (`docker-compose.yml`) und Produktion (`docker/docker-compose.prod.yml`, `docker/docker-compose.registry.yml`).
  - Automatisierte Proxmox LXC/VM Deployment-Skripte (`scripts/deploy_proxmox.sh`).
  - Automatisierte GitHub Actions CI/CD Pipeline.

---

## Archiv: Prototyp-Phase (Februar – März 2026)

*(Historische Git-Tags: `v1.0.0` – `v1.7.0`)*

- Initialer Proof-of-Concept und Prototyp mit React/Vite-Frontend und PostgreSQL-Backend.
- Erste Anbindung an die Discogs-API, Abspielhistorien-Logging, Barcode-Scanning und Basisauswertungen.
- Erprobung der Docker-Containerisierung und GitHub Actions Automatisierung.
- *(Sämtliche historischen Git-Tags `v1.0.0` bis `v1.7.0` sowie `v2.0.0` bis `v2.4.1` bleiben für Nachvollziehbarkeit im Git-Repository erhalten).*
