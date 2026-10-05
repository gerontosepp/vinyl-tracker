# Release-Info

Übersicht der Änderungen und Meilensteine des Projekts **Vinyl Tracker**.

> [!NOTE]
> Mit Version **v0.2.1** wurde das Versionsschema re-baselined (vorherige Versionen trugen historisch `v1.x` / `v2.x`-Bezeichnungen), um den Work-in-Progress (WiP) / Beta-Charakter des Projekts klar zu kennzeichnen. Frühere Versionen sind hier chronologisch in konsistente Meilensteine zusammengefasst.

---

## v0.2.1 (2026-10-05) – Aktueller Release (WiP / Beta)

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
