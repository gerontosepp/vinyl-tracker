# Release-Info

Kurze Uebersicht der Aenderungen je Version (abgeleitet aus Git-Tags und Commit-Historie).

## Unreleased

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
