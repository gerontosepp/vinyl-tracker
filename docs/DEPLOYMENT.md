# Deployment Anleitung

Diese Anleitung erklärt, wie Sie **Vinyl Tracker** auf einem Server oder auf einem anderen Gerät bereitstellen (deployen) können, ohne den Quellcode dorthin kopieren zu müssen.

## 1. Voraussetzungen

Die Zielmaschine benötigt:
- **Docker** und **Docker Compose** installiert.
- **Git** (optional, nicht zwingend erforderlich für das Deployment über eine Registry).

## 2. Images bauen

Die Zielmaschine benötigt Zugriff auf die Docker Images. Sie haben zwei Möglichkeiten:

### Option A: Automatisiert via CI/CD (Empfohlen)
Dieses Projekt ist mit GitHub Actions so konfiguriert, dass es automatisch Images baut und in die **GitHub Container Registry (GHCR)** pusht, sobald Änderungen in den `main`-Branch gemergt werden.

Die GitHub Actions CI Pipeline führt automatisch Tests, Linting und Coverage-Prüfung für das Rust-Backend (`cargo test`, `cargo clippy`, `cargo llvm-cov`) und den MCP-Server sowie die Unit- (Vitest) und E2E-Tests (Playwright) für das Frontend aus. Anschließend werden Multi-Arch Docker-Images gebaut und publiziert.

1.  Mergen Sie Ihre fertigen Features aus `develop` in den `main` Branch.
2.  Die GitHub Actions "CI Pipeline" baut und testet das Projekt vollautomatisch.
3.  Die Images stehen öffentlich (**Public**) unter folgenden Adressen bereit:
    - `ghcr.io/gerontosepp/vinyl-tracker-backend:latest` (oder z.B. `:v0.7.0`)
    - `ghcr.io/gerontosepp/vinyl-tracker-frontend:latest` (oder z.B. `:v0.7.0`)

> [!NOTE]
> Die Docker-Images sind in der GitHub Container Registry öffentlich zugänglich (**Public**). Sie können auf jedem Server direkt ohne Authentifizierung (`docker login` oder Personal Access Token) heruntergeladen werden.

### Option B: Manueller Build
Wenn Sie die Images manuell von Ihrem Entwicklungsrechner bauen und pushen möchten:

1.  **Beim Registry-Anbieter einloggen**:
    ```bash
    docker login
    ```
2.  **Das Build & Push Skript ausführen**:
    ```bash
    # Ersetzen Sie 'meinbenutzer/' durch Ihren Docker Hub Benutzernamen oder Ihre Registry-URL
    ./scripts/push-images.sh meinbenutzer/
    ```

## 3. Vorbereitung (Auf der Zielmaschine)

Sie benötigen lediglich **zwei Dateien** auf der Zielmaschine (plus Zertifikate, falls Sie lokales SSL nutzen):
1.  `docker/docker-compose.registry.yml` (zur Vereinfachung in `docker-compose.yml` umbenennen).
2.  `.env` (Konfiguration).

### Dateien übertragen
Sie können diese Dateien herunterladen, ohne das gesamte Git-Repository clonen zu müssen. Führen Sie auf Ihrem Server einfach folgende Befehle aus:

```bash
wget https://raw.githubusercontent.com/gerontosepp/vinyl-tracker/main/docker/docker-compose.registry.yml -O docker-compose.yml
wget https://raw.githubusercontent.com/gerontosepp/vinyl-tracker/main/.env.example -O .env
```
*(Alternativ können Sie die beiden Dateien natürlich auch via `scp`, SFTP oder USB-Stick auf Ihren Server kopieren).*

### Konfiguration (.env)
**Wichtiger Schritt**: Konfigurieren Sie die Umgebungsvariablen.

1.  Kopieren Sie die `.env.example` (oder erstellen Sie eine neue `.env` Datei).
2.  Setzen Sie ein sicheres Passwort für `POSTGRES_PASSWORD` und `VINYL_ENCRYPTION_PASSWORD`.
3.  **Wichtig für den Salt & JWT:** 
    - Der `VINYL_ENCRYPTION_SALT` **MUSS** ein gültiger Hexadezimal-String sein (z.B. 16 Zeichen).
    - Der `JWT_SECRET` **MUSS** ein sicheres, langes Passwort (mindestens 32 Zeichen) zur Session-Sicherung sein.
4.  **Registry Prefix & Version konfigurieren (optional)**:
    Standardmäßig greift `docker-compose.registry.yml` direkt auf die öffentlichen Images `ghcr.io/gerontosepp/` zu (kein Login erforderlich). Eine Anpassung ist nur nötig, wenn Sie eigene Builds/Forks verwenden:
    - **Offizielle Images (Default)**:
      ```bash
      REGISTRY_PREFIX=ghcr.io/gerontosepp/
      IMAGE_TAG=latest # oder z.B. v0.7.0
      ```
    - **Für manuelle / eigene Builds (Option B)**:
      ```bash
      REGISTRY_PREFIX=meinbenutzer/
      IMAGE_TAG=latest
      ```
5.  **Datenbank-Migrationen**:
    Das Backend führt beim Start automatisch alle ausstehenden Migrationen aus (`sqlx::migrate`, Historie in `_sqlx_migrations`). Bestehende Datenbanken mit `refinery_schema_history` oder `flyway_schema_history` werden beim ersten Start automatisch übernommen, ohne Migrationen erneut auszuführen ([ADR-0017](adr/0017-datenbank-migrationen-mit-sqlx-migrate.md)). Erstellen Sie vor Updates trotzdem ein Backup (siehe [Datenbank-Backup](#datenbank-backup--wiederherstellung)).
6.  **Weitere Backend-Einstellungen**:
    Alle Umgebungsvariablen des Backends mit Defaults sind im [README](../README.md#2-setup-environment-variables) aufgeführt. Für den Produktivbetrieb wichtig: `APP_ENV=production` (aktiviert `Secure`-Cookies und verbietet den Entwicklungs-`JWT_SECRET`) sowie eigene Werte für `VINYL_ENCRYPTION_PASSWORD`/`VINYL_ENCRYPTION_SALT`.
7.  **Logging**:
    Das Backend schreibt Text-Logs über `tracing` nach stdout (`docker logs vinyl-backend-prod`). Der Detailgrad wird über `RUST_LOG` gesteuert (in den Prod-Compose-Dateien: `info,backend_rs=info,tower_http=info`). Eine OpenAPI-/Swagger-Oberfläche stellt das Backend nicht bereit.

## 4. Anwendung starten

### Option A: Automatisiertes Deployment-Skript (Empfohlen für Proxmox / LXC / VMs)
Nutzen Sie das bereitgestellte Skript `./scripts/deploy_proxmox.sh` für die automatische Erstellung sicherer `.env`-Geheimnisse, das Herunterladen der aktuellen Docker-Images und die Ausführung des Healthchecks:

```bash
# Neuestes Release (latest) installieren/aktualisieren:
./scripts/deploy_proxmox.sh

# Ein spezifisches Release installieren:
./scripts/deploy_proxmox.sh v0.7.0
```

### Option B: Manuelles Docker Compose
Starten Sie die Anwendung manuell mit der Registry-Konfiguration:

```bash
docker compose -f docker/docker-compose.registry.yml up -d
```

*Images werden standardmäßig als `latest` gezogen.*

Die Anwendung läuft nun auf **Port 80** der Zielmaschine.

### Datenbank-Backup & Wiederherstellung

Das Skript `scripts/backup_db.sh` sichert die Datenbank aus dem laufenden Container `vinyl-postgres-prod` per `pg_dump` (komprimiertes Custom-Format), prüft das Backup (lesbar, enthält `app_user`, `record_cache`, `collection_item`, `listen_event`) und löscht Backups, die älter als 14 Tage sind. Zugangsdaten werden aus dem Container gelesen – kein Passwort nötig.

```bash
# Backup erstellen (z. B. vor jedem Update)
./scripts/backup_db.sh                      # -> ./backups/vinyl-<datum>-<zeit>.dump

# Nächtlich per Cron (03:00 Uhr)
0 3 * * * cd /opt/vinyl-tracker && ./scripts/backup_db.sh >> backups/backup.log 2>&1

# Wiederherstellen (stoppt das Backend, fragt nach Bestätigung)
./scripts/backup_db.sh --restore backups/vinyl-<datum>-<zeit>.dump
```

`./scripts/deploy_proxmox.sh` erstellt vor jedem Update automatisch ein solches Backup (nach dem Herunterladen der neuen Images, vor dem Stoppen der alten Container). Schlägt das Backup fehl, bricht das Deployment ab; mit `SKIP_DB_BACKUP=1` lässt sich der Schritt bewusst überspringen. Bei einer Erstinstallation (noch keine Datenbank) entfällt er automatisch.

Anpassbar über Umgebungsvariablen: `VINYL_DB_CONTAINER`, `VINYL_BACKEND_CONTAINER`, `BACKUP_DIR` (Default `./backups`), `BACKUP_RETENTION_DAYS` (Default `14`, `0` = alle behalten). Kopieren Sie Backups zusätzlich auf ein anderes System (z. B. per `scp` oder `rsync`) – ein Backup auf demselben Server schützt nicht vor dessen Ausfall.

Nach einem Restore die zum Backup passende Anwendungsversion starten (`./scripts/deploy_proxmox.sh <version>`). Da `--restore` auch `_sqlx_migrations` zurücksetzt, findet eine ältere Version ihre Migrationshistorie unverändert vor.

## 5. Deployment hinter einem Reverse Proxy (z.B. Proxmox)

Für den produktiven Einsatz auf einem Server (z.B. als Docker-VM unter Proxmox) wird ein vorgeschalteter **Reverse Proxy** (wie Nginx Proxy Manager, Traefik oder Caddy) dringend empfohlen. Dieser übernimmt das SSL-Zertifikatsmanagement zentral für alle Dienste, sodass `mkcert` überflüssig wird.

> **Wichtig:** Barcode-Scanning benötigt für den Kamerazugriff zwingend eine gültige `HTTPS`-Verbindung (Secure Context). Andernfalls blockieren Handy-Browser die Kamera kommentarlos!

### So funktioniert das Setup mit Nginx Proxy Manager (NPM):

1. **Domain einrichten**: Richte eine DynDNS- oder Sub-Domain ein (z.B. `vinyl.meinedomain.de`), die auf deinen Heimrouter/Server zeigt.
2. **Vinyl Tracker starten**: Führe `docker compose -f docker/docker-compose.prod.yml up -d` aus (oder die `docker/docker-compose.registry.yml` Variante). Der Frontend-Container läuft nun lokal isoliert auf Port `80`.
3. **Im Nginx Proxy Manager konfigurieren**:
   - Erstelle einen neuen Proxy Host.
   - **Domain Names**: `vinyl.meinedomain.de`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: Die interne IP deiner Vinyl Tracker Docker VM (z.B. `192.168.1.100`)
   - **Forward Port**: `80` (Der Port, auf den der `vinyl-frontend-prod` Container im Netzwerk mappt)
   - **Websockets Support**: Aktivieren (hilft bei einigen API Headern)
4. **SSL Zertifikat im NPM anfordern**:
   - Gehe zum Reiter `SSL`.
   - Wähle "Request a new SSL Certificate".
   - Aktiviere "Force SSL".
   - Speichern. Nginx Proxy Manager besorgt nun via Let's Encrypt ein gültiges Zertifikat.
5. **`.env` auf dem Server anpassen**:
   ```env
   # Cookies nur über HTTPS (Default bei APP_ENV=production)
   APP_ENV=production
   AUTH_COOKIE_SECURE=true
   # IP des Reverse Proxys ergänzen, falls er nicht in den Docker-Netzen liegt
   TRUSTED_PROXIES=172.16.0.0/12,192.168.0.0/16,<IP-des-Reverse-Proxys>
   ```
   > [!IMPORTANT]
   > Das Login-Rate-Limit arbeitet pro Client-IP. Steht die IP des Reverse Proxys nicht in `TRUSTED_PROXIES`, teilen sich alle Benutzer das Kontingent des Proxys ([ADR-0016](adr/0016-vertrauenswuerdige-proxies-fuer-client-ip-ermittlung.md)).
   >
   > `CORS_ALLOWED_ORIGINS` ist hier nicht nötig: Frontend und API werden über nginx unter derselben Domain ausgeliefert (gleicher Origin). Die Liste ist nur relevant, wenn das Frontend von einem anderen Origin auf die API zugreift (z. B. Entwicklungsserver auf `https://localhost:5173`).

Ab jetzt erreicht jedes Gerät (auch dein Smartphone) die App über `https://vinyl.meinedomain.de` mit einem zu 100% gültigen und vertrauenswürdigen Zertifikat. Der Kamera-Zugriff für das Barcode-Scanning wird ohne Warnungen gestattet!

### Lokales Setup / Entwicklung (Ohne Domain)
Für die reine Entwicklung auf einem lokalen Laptop ohne eigene Domain wird weiterhin `docker-compose.yml` (`npm run dev`) zusammen mit `mkcert` verwendet, da hier kein Reverse Proxy zur Verfügung steht, der Let's Encrypt Zertifikate validieren könnte. (Siehe Haupt-README).

---

## 6. Eigene CI/CD Runner (Self-Hosted Runner)

Die CI-Jobs (`runs-on: [self-hosted, linux]`) laufen auf selbst betriebenen GitHub-Actions-Runnern. Aktuell sind das Docker-Container auf Hetzner-Cloud-Servern (ARM64, Labels `self-hosted,Linux,ARM64,cax21`); jeder Linux-Docker-Host (z. B. auch eine Proxmox-VM) eignet sich.

### Architektur & Hybrid-CI
- **Alltägliche Builds (Commits & PRs)**: Laufen auf den Self-Hosted-Runnern.
  - Rust-Toolchain (Backend inkl. `cargo-llvm-cov`, MCP-Server); ein PostgreSQL-Testcontainer wird über den gemounteten Docker-Socket (`/var/run/docker.sock`) gestartet.
  - Node 24, Vitest-Unit-Tests (`jsdom`, kein Browser nötig) und Playwright-E2E-Tests (eigenes Chromium).
  - Drei Jobs (Backend, Frontend, MCP) laufen parallel, wenn genügend Runner frei sind.
- **Image-Publish**: Pushes auf `main` bauen Multi-Arch-Images (`linux/amd64`, `linux/arm64`) und veröffentlichen sie in GHCR.
- **Releases** (`release.yml`, beim Merge eines PRs nach `main`): GitHub-Release plus GitHub-gehostete Runner (`ubuntu-latest`, `macos-latest`) für native MCP-Binaries.

### Sicherheitshinweise (Wichtig bei öffentlichen Repositories)
1. Im GitHub-Repo unter **Settings** → **Actions** → **General** → **Fork pull request workflows** die Freigabe für alle externen Mitwirkenden verlangen (aktuell aktiv: `all_external_contributors`).
2. Alle Actions sind auf Commit-SHAs gepinnt; Dependabot hält sie aktuell.
3. Der gemountete Docker-Socket gibt Jobs Root-Rechte auf dem Host. Empfohlen sind **ephemere Runner** (ein frischer Container pro Job, z. B. `EPHEMERAL=true` mit `docker run --rm` über systemd) und ein **fine-grained PAT** nur für dieses Repository mit der Berechtigung `Administration: Read and write`.

### Runner mit Docker Compose einrichten
Vorlage: [`docker/docker-compose.runner.yml`](../docker/docker-compose.runner.yml) (Image `myoung34/github-runner:ubuntu-noble`, zwei Runner für parallele Jobs). Namen und Labels in der Vorlage an den eigenen Host anpassen.

> **Wichtiger Hinweis zum Image:** Verwenden Sie `ubuntu-noble` (Ubuntu 24.04 LTS). Das veraltete `latest` (Ubuntu 20.04) wird von modernen Versionen von Playwright und Node.js nicht mehr unterstützt.

### Inbetriebnahme auf dem Runner-Host
1. **Token holen**:
   - **Option A (Empfohlen für Dauerbetrieb)**: Fine-grained Personal Access Token (Repository `vinyl-tracker`, Berechtigung `Administration: Read and write`) als `ACCESS_TOKEN` eintragen. Damit holt sich der Runner selbst Registrierungs-Tokens.
   - **Option B**: Auf GitHub unter **Settings** → **Actions** → **Runners** → **New runner** einen temporären Registrierungstoken kopieren und als `RUNNER_TOKEN` eintragen (gilt nur 1 Stunde).
2. **Starten**:
   ```bash
   ACCESS_TOKEN="<DEIN_TOKEN>" docker compose -f docker/docker-compose.runner.yml up -d
   docker compose -f docker/docker-compose.runner.yml logs -f
   ```
3. Sobald `Listening for Jobs` in den Logs erscheint, ist der Runner aktiv. Status aller Runner: **Settings** → **Actions** → **Runners**.

### Live-Logüberwachung mit Dozzle
Wenn auf dem Runner-Server Dozzle (auf Port 8888) läuft, kann mit folgendem Skript ein SSH-Tunnel aufgebaut und das Dozzle-Dashboard direkt in einem minimalen App-Browserfenster gestartet werden:

```bash
# Tunnel aufbauen und Dozzle öffnen:
./scripts/open_dozzle.sh

# Tunnel beenden:
./scripts/open_dozzle.sh --stop
```