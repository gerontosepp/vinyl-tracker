# Release-Info

Kurze Uebersicht der Aenderungen je Version (abgeleitet aus Git-Tags und Commit-Historie).

## Unreleased

## v2.4.1 (2026-10-05)
- **Neue Backend REST-APIs & MCP-Tools**:
  - `GET /api/collection/random` & MCP-Tool `get_random_record`: Liefert zufällige Empfehlungen aus der Vinyl-Sammlung mit optionalem Genre-Filter und "Nur ungespielte Platten"-Modus.
  - `GET /api/collection/unplayed` & MCP-Tool `get_unplayed_records`: Paginierte Liste ungespielter Alben der Sammlung ("Shelf of Shame").
  - `GET /api/records/{id}` & MCP-Tool `get_record_details`: Umfassende Album-Details inklusive Tracklist, Release-Formate, Labels, Notizen und persönlicher Abspielhistorie.
  - `GET /api/discogs/search` & MCP-Tool `search_discogs`: Globale Discogs-Datenbanksuche nach Alben, Künstlern und Releases.
- **Format-Anzeige & Icons in der Plattenliste**:
  - Neue Spalte "Format" nach der Spalte "Cover" in der Alben-Tabelle mit Icons für CD (`LucideDiscAlbum`), LP (`LucideDisc`) und Double LP (`2xLP`).
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
  - Ausführung von 12 Playwright E2E-Tests in der GitHub Actions CI-Pipeline (`ci.yml`) mit automatischem Browser-Setup und non-interaktivem Reporting.
  - Automatisierte Generierung von Entwicklungs-SSL-Zertifikaten (`ensure-certs.js`) für `ng serve`, um ENOENT-Fehler in frischen CI- und Headless-Testumgebungen zu verhindern.
  - GitHub Actions Workflow auf Node 24 vereinheitlicht (`setup-node` und `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`).
  - 146 Backend-Tests mit JaCoCo-Mindestabdeckung (> 80 %) und 64 Frontend-Unit-Tests erfolgreich.
- **Backend-Architektur & Qualität**:
  - `ResourceNotFoundException` mit standardisierten RFC 7807 `ProblemDetail`-Antworten (HTTP 404).
  - `IllegalArgumentException`-Mapping auf HTTP 400 mit strukturierter Fehlerausgabe.
- **Rust MCP Server Erweiterung**:
  - Werkzeugsatz auf 14 native Tools erweitert mit vollständiger Typisierung, DTO-Mapping und Unittests.
- **Dependencies**:
  - Frontend: `@lucide/angular` (1.41.0 -> 1.51.0), `@playwright/test` (1.62.1 -> 1.63.0) sowie transitive npm-Abhängigkeiten im Lockfile aktualisiert.
  - MCP Server (Rust): `tokio` (1.53.1 -> 1.53.2), `uuid` (1.26.1 -> 1.27.0), `cc` (1.5.1 -> 1.6.0), `libc` (0.2.189 -> 0.2.190) aktualisiert.
  - Backend: Geprüft und auf aktuellem, kompatiblem Stand validiert.

## v2.3.0 (2026-10-02)
- **Model Context Protocol (MCP) Server (Rust)**:
  - Neuer, hochperformanter MCP-Server in Rust unter `mcp/` basierend auf dem offiziellen `rmcp` SDK (v3.5) und `tokio`.
  - 10 MCP-Tools zur Steuerung über KI-Assistenten (Antigravity IDE, Claude Desktop, Cursor): Sammlung abfragen (`get_user_collection`), Discogs-Synchronisation (`sync_collection`), Barcode-/QR-Code-Scans protokollieren (`scan_barcode`), Hördurchgänge verwalten/löschen (`delete_scan`, `reset_all_listens`), Analytics & Top-Alben (`get_recent_listens`, `get_top_records`, `get_collection_value`, `get_genre_breakdown`) sowie Benutzerprofil (`get_current_user`).
  - REST-Client-Architektur mit automatischem Backend-Login (`/api/users/login`), dynamischem Cookie-Lifecycle-Management (`vinyl_token`) und flexibler Casing-Unterstützung (Snake- & CamelCase).
  - Umfassende Unit-Test-Suite für DTOs, Serialisierung und Router-Registrierung (`cargo test`).
- **CI/CD & Multi-Plattform-Releases**:
  - Neuer `mcp-build`-Job in der GitHub Actions CI-Pipeline (`.github/workflows/ci.yml`).
  - Automatisierte Release-Verpackung: Vorkompilierte Binärdateien für Linux (`linux-x86_64`) und macOS (`macos-aarch64` Apple Silicon) werden bei jedem Release automatisch als Assets hochgeladen.
- **Dokumentation**:
  - Detaillierte Installations-, Konfigurations- und Nutzungsanleitung in `mcp/README.md`.
  - Aktualisierung von `README.md` und der Architektur-Dokumentation `docs/arc42.md`.

## v2.2.0 (2026-09-04)
- Workspace Skills: Standardisierte AI-Agent-Skills unter `.agent/skills/` integriert (`release-management`, `dependency-updates`, `database-migrations`, `proxmox-deployment`).
- Dependencies: Frontend (Angular 19.2.25/19.2.27, Lucide Angular 1.41.0, PostCSS 8.5.28, RxJS 7.8.2, TypeScript 5.7.3) und Backend (Lombok 1.18.46, Logstash-Logback-Encoder 9.0) aktualisiert.
- Security & Fixes: Transitive Abhängigkeiten gehärtet und `release.sh` für plattformübergreifende Ausführung (Linux / macOS) optimiert.

## v2.1.3 (2026-09-04)
- Dependencies: Frontend (Angular 19.2.25/19.2.27, Lucide Angular 1.41.0, PostCSS 8.5.28, RxJS 7.8.2, TypeScript 5.7.3) und Backend (Lombok 1.18.46 Compiler-Plugin Sync, Logstash Logback Encoder 9.0) aktualisiert.
- Security: Transitive NPM-Abhängigkeiten aktualisiert und Sicherheitswarnungen reduziert.
- Release-Automatisierung: `release.sh` für Linux-Umgebungen (GNU `sed`) portabel gemacht (`sedi`-Funktion).
- Build-Optimierung: Angular-CLI-Analytics in `angular.json` deaktiviert zur Vermeidung interaktiver Prompts bei Container- und CI-Builds.

## v2.1.2 (2026-08-06)
- Framework: Backend-Upgrade auf Spring Boot 4.1.0.
- Deployment: Automatisiertes Deployment-Skript für Proxmox (`deploy_proxmox.sh`) und Dokumentation des Workflows hinzugefügt.
- Dependencies: Frontend- und Backend-Projekt-Dependencies aktualisiert.
- Resilienz: Resilience4j-Spring-Boot3-Abhängigkeit auf 2.2.0 für optimale Kompatibilität stabilisiert.

## v2.1.1 (2026-08-05)
- API-Dokumentation: OpenAPI/Swagger UI (springdoc) integriert (`/swagger-ui.html`, `/v3/api-docs`); in Produktion via `SPRINGDOC_*_ENABLED=false` deaktiviert.
- Performance: `Record.genres` `@ElementCollection` auf `LAZY` mit Hibernate `@BatchSize(50)` umgestellt, um N+1-Genre-Abfragen zu vermeiden.
- Dependencies: Backend auf Spring Boot 4.0.4 aktualisiert.

## v2.0.0 (2026-07-15)
- Migration: Frontend komplett von React/Vite auf Angular 19 migriert.
- Testing: Umfassende Jasmine/Karma-Unittests fuer core Services, shared Layout-Komponenten und Utility-Funktionen eingefuehrt.
- Code-Coverage: Abdeckungsbericht fuer Angular-Frontend auf >90% angehoben (Uebererfuellung des >80% Projektziels).
- Dokumentation: README.md und arc42.md vollständig an die neue Angular-Struktur angepasst.
- Docker-DevEx: Healthcheck fuer Postgres hinzugefuegt und Maven Layer-Caching optimiert.

## v1.7.0 (2026-03-17)
- Neue Funktion: "Reset All Listens" im Frontend inkl. bestaetigendem Dialog.
- Statistik erweitert: Verlauf/History fuer Collection-Value.
- Layout-/Profil-Navigation und Dashboard-Resilienz verbessert.
- Backend gehaertet: Discogs-Parsing, Genre-Mapping und Analytics-Fehlerbehandlung verbessert.

## v1.6.1 (2026-03-09)
- Vite-Proxy-Code vereinfacht (Typbehandlung fuer Request-Startzeit reduziert/vereinheitlicht).

## v1.6.0 (2026-03-09)
- Suche in der Collection (Frontend + Backend) eingefuehrt.
- Collection-UI fuer Header, Filter, Sortierung und Pagination ueberarbeitet.
- Dashboard-/Collection-Tests deutlich ausgebaut (u. a. Date-Filter, Sortierung, Interceptors).
- Branding/Logo und Farbwelt aktualisiert.

## v1.5.1 (2026-03-08, Tag: V1.5.1)
- Migration auf Tailwind CSS v4 und zugehoerige Dependency-Updates.
- CI-Fix fuer Container-Retention-Policy (UTC/Validierungsproblem behoben).

## v1.5.0 (2026-03-04, Tag: v.1.5.0)
- Lokales Discogs-Collection-Management und Synchronisationsfluss erweitert.
- Refactor: Controller-Logik in dedizierte Service-Schicht verschoben.
- Zusaetzliche Unit-Tests fuer zentrale Services (u. a. Collection/Analytics/AppUser).
- Frontend-Dependencies aktualisiert; CI fuer GHCR-Image-Retention verbessert.

## v1.4.1 (2026-03-02)
- Tag-basierte Docker-Image-Builds und GHCR-Push ueber GitHub Releases eingefuehrt.
- Release-/Dokumentations-Workflow fuer Artefakte mit Tags ergaenzt.

## v1.4.0 (2026-02-27)
- Image-Proxy fuer Discogs-Bilder implementiert (CORS/403-Probleme reduziert).
- Security-Konfiguration fuer Proxy-Endpunkte angepasst.
- Frontend auf proxied Image-URLs umgestellt (Collection, Scanner, Dashboard-Listen).
- Test-/Stabilitaetsfixes (u. a. Spring-Test-Anpassungen und DB-FK-Testbereinigung).

## v1.3.1 (2026-02-23)
- Nginx-Log-Format-Fix im richtigen Konfigurationskontext.
- Deployment-Doku deutlich ueberarbeitet (inkl. deutscher Uebersetzung und Server-Setup-Hinweisen).
- Versions-/Dokumentationsabgleich fuer Backend aktualisiert.

## v1.3.0 (2026-02-23)
- API-Request-Logging in Frontend und Backend eingefuehrt (Observability verbessert).
- UserResponseDto eingefuehrt, um sensible User-Daten besser abzuschirmen.
- Collection-Sortierung (Listens/Artist/Release Date) erweitert.
- Build/Test-Stack aktualisiert (u. a. Spring Boot/Testcontainers-Konfiguration).

## v1.2.0 (2026-02-18)
- QR-Code-Generierung fuer Collection und Download integriert.
- Date-Range-Filter fuer Dashboard-/Analytics-Daten eingefuehrt.
- Collection-Filterung nach Mindestanzahl Plays ergaenzt.
- Umfangreiche Frontend-/Backend-Tests und CI-Anpassungen erweitert.

## v1.1.3 (2026-02-17)
- MIT-Lizenz und Projektregeln ergaenzt.
- Docker-Update-Skript und Build-/Git-Fixes aufgenommen.
- JaCoCo-/Test-Coverage-Konfiguration verbessert.
- CI/JDK-Kompatibilitaet (Lombok/JDK 21) stabilisiert.

## v1.1.2 (2026-02-16)
- E2E-Test-Setup und Pipeline mehrfach nachgeschaerft.
- Code-Quality-Setup und Docker-Optimierungen ergaenzt.
- Dokumentation aktualisiert.

## v1.1.1 (2026-02-16)
- Release-Skript verbessert: README-Version im Header wird beim Release mitgezogen.

## v1.1.0 (2026-02-16)
- Login-Flow angepasst.
- Mindest-Coverage (80%) fuer Frontend und Backend verbindlich gemacht.
- Versionsnummer-Anzeige im Frontend eingefuehrt.

## v1.0.0 (2026-02-16)
- Initialer Release-Stand mit Build-/Pipeline-Basis.
- Frontend-Test- und Dependency-Fixes sowie Vite-Build-Korrekturen.
- Lokale Zertifikatsnutzung fuer sichere lokale Entwicklungsumgebung dokumentiert.
