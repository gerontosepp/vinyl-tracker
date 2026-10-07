# Deployment Anleitung

Diese Anleitung erklärt, wie Sie **Vinyl Tracker** auf einem Server oder auf einem anderen Gerät bereitstellen (deployen) können, ohne den Quellcode dorthin kopieren zu müssen.

## 1. Voraussetzungen

Die Zielmaschine benötigt:
- **Docker** und **Docker Compose** installiert.
- **Git** (optional, nicht zwingend erforderlich für das Deployment über eine Registry).

## 2. Images bauen

Die Zielmaschine benötigt Zugriff auf die Docker Images. Sie haben zwei Möglichkeiten:

### Option A: Automatisiert via CI/CD (Empfohlen)
Dieses Projekt ist mit GitHub Actions so konfiguriert, dass es automatisch Images baut und in die **GitHub Container Registry (GHCR)** pusht, sobald Änderungen in den `main`-Branch gemergt werden oder ein Release-Tag erstellt wird.

Voraussetzung für den Backend-Build in CI ist zusätzlich ein Online-Dependency-Scan via Sonatype OSS Index. Dafür müssen im GitHub-Repository diese **Actions Secrets** gesetzt sein:
- `OSSINDEX_USERNAME`
- `OSSINDEX_TOKEN`

Zusätzlich wird der Backend-Job mit `mvn clean verify -Psecurity-online` ausgeführt. Dabei laufen Unit-Tests (Surefire) und Integrationstests (Failsafe). In CI wird für den Integrations-Shutdown explizit ein robuster Timeout gesetzt:
- `-Dtest.integration.forkedProcessExitTimeoutInSeconds=120`

1.  Mergen Sie Ihre fertigen Features aus `develop` in den `main` Branch (oder erstellen Sie ein Release-Tag).
2.  Die GitHub Actions "CI Pipeline" baut und testet das Projekt vollautomatisch.
3.  Die Images stehen öffentlich (**Public**) unter folgenden Adressen bereit:
    - `ghcr.io/gerontosepp/vinyl-tracker-backend:latest` (oder z.B. `:v0.3.0`)
    - `ghcr.io/gerontosepp/vinyl-tracker-frontend:latest` (oder z.B. `:v0.3.0`)

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
      IMAGE_TAG=latest # oder z.B. v0.3.0
      ```
    - **Für manuelle / eigene Builds (Option B)**:
      ```bash
      REGISTRY_PREFIX=meinbenutzer/
      IMAGE_TAG=latest
      ```
5.  **Datenbank-Migrationen & Flyway Baselining**:
    Wenn Sie die Anwendung gegen eine bereits existierende Datenbank deployen, stellen Sie sicher, dass `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` in Ihrer `.env` oder der Compose-Datei gesetzt ist (standardmäßig in `docker/docker-compose.registry.yml` und `docker/docker-compose.prod.yml` aktiviert), um die Datenbank korrekt zu initialisieren.
6.  **OpenAPI / Swagger-Dokumentation**:
    In Produktionsumgebungen ist die API-Dokumentation standardmäßig deaktiviert, um API-Details nicht ungeschützt offenzulegen. Gesteuert wird dies über die Umgebungsvariablen:
    - `SPRINGDOC_API_DOCS_ENABLED=false`
    - `SPRINGDOC_SWAGGER_UI_ENABLED=false`
7.  **Strukturiertes JSON-Logging**:
    Durch das Setzen von `SPRING_PROFILES_ACTIVE=prod` in der Docker Compose Konfiguration wird die Logausgabe des Backends auf JSON-Format umgestellt. Dies erleichtert das automatische Einlesen, Filtern und Durchsuchen der Logs durch Log-Aggregatoren (z.B. Loki, Logstash, Fluentd).

## 4. Anwendung starten

### Option A: Automatisiertes Deployment-Skript (Empfohlen für Proxmox / LXC / VMs)
Nutzen Sie das bereitgestellte Skript `./scripts/deploy_proxmox.sh` für die automatische Erstellung sicherer `.env`-Geheimnisse, das Herunterladen der aktuellen Docker-Images und die Ausführung des Healthchecks:

```bash
# Neuestes Release (latest) installieren/aktualisieren:
./scripts/deploy_proxmox.sh

# Ein spezifisches Release installieren:
./scripts/deploy_proxmox.sh v0.3.0
```

### Option B: Manuelles Docker Compose
Starten Sie die Anwendung manuell mit der Registry-Konfiguration:

```bash
docker compose -f docker/docker-compose.registry.yml up -d
```

*Images werden standardmäßig als `latest` gezogen.*

Die Anwendung läuft nun auf **Port 80** der Zielmaschine.

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
5. **CORS in `.env` konfigurieren**:
   Tragen Sie Ihre Domain in der `.env`-Datei auf dem Server ein:
   ```env
   CORS_ALLOWED_ORIGINS=https://vinyl.meinedomain.de,https://localhost:5173,https://127.0.0.1:5173
   ```
   > [!IMPORTANT]
   > Moderne Browser senden bei POST-Anfragen (Login, Registrierung) stets einen `Origin`-Header. Wenn Ihre Domain nicht in `CORS_ALLOWED_ORIGINS` hinterlegt ist, blockiert Spring Boot die Anfrage mit einem HTTP `403 Invalid CORS request` Fehler.

Ab jetzt erreicht jedes Gerät (auch dein Smartphone) die App über `https://vinyl.meinedomain.de` mit einem zu 100% gültigen und vertrauenswürdigen Zertifikat. Der Kamera-Zugriff für das Barcode-Scanning wird ohne Warnungen gestattet!

### Lokales Setup / Entwicklung (Ohne Domain)
Für die reine Entwicklung auf einem lokalen Laptop ohne eigene Domain wird weiterhin `docker-compose.yml` (`npm run dev`) zusammen mit `mkcert` verwendet, da hier kein Reverse Proxy zur Verfügung steht, der Let's Encrypt Zertifikate validieren könnte. (Siehe Haupt-README).

---

## 6. Eigener CI/CD Runner auf Proxmox (Self-Hosted Runner)

Um Build- und Testzeiten zu minimieren und GitHub-Warteschlangen für die Testcontainers- und Playwright-Suites zu vermeiden, unterstützt Vinyl Tracker den Betrieb eines **Self-Hosted GitHub Actions Runners** auf Proxmox (z. B. in einer dedizierten Docker-VM oder einem LXC-Container).

### Architektur & Hybrid-CI
- **Alltägliche Builds (Commits & PRs)**: Laufen direkt auf dem Proxmox-Runner (`[self-hosted, linux]`).
  - Java 25 & Maven 3.9.9 via GitHub Actions Cache
  - Testcontainers startet echte PostgreSQL-Instanzen über den gemounteten Docker-Socket (`/var/run/docker.sock`)
  - Node 24, Chrome Headless & Playwright E2E-Tests
  - Rust Toolchain & MCP Server Tests
- **Multi-Plattform Releases**: Bei Release-Tags (`v*.*.*`) startet GitHub zusätzlich Cloud-Runner (`macos-latest` Apple Silicon) für native macOS MCP-Binaries.

### Sicherheitshinweis (Wichtig bei öffentlichen Repositories)
In einem öffentlichen Repository könnten fremde Forks ohne Freigabe bösartigen Code auf Ihrem heimischen Server ausführen. Aktivieren Sie zwingend:
1. Im GitHub-Repo: **Settings** → **Actions** → **General**
2. Unter **Fork pull request workflows**: **"Require approval for all outside collaborators"** auswählen und speichern.

### Runner mit Docker Compose einrichten (Multi-Runner für parallele Jobs)
Verwenden Sie die Vorlage [`docker/docker-compose.runner.yml`](../docker/docker-compose.runner.yml):

```yaml
services:
  github-runner-01:
    image: myoung34/github-runner:ubuntu-noble
    container_name: proxmox-github-runner-01
    restart: unless-stopped
    environment:
      REPO_URL: "https://github.com/gerontosepp/vinyl-tracker"
      RUNNER_TOKEN: "${RUNNER_TOKEN:-}"
      ACCESS_TOKEN: "${ACCESS_TOKEN:-}"
      RUNNER_NAME: "${RUNNER_NAME_01:-proxmox-runner-01}"
      RUNNER_WORKDIR: "/_work"
      RUNNER_GROUP: "default"
      LABELS: "self-hosted,linux,x64,proxmox"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner-work-01:/_work

  github-runner-02:
    image: myoung34/github-runner:ubuntu-noble
    container_name: proxmox-github-runner-02
    restart: unless-stopped
    environment:
      REPO_URL: "https://github.com/gerontosepp/vinyl-tracker"
      RUNNER_TOKEN: "${RUNNER_TOKEN:-}"
      ACCESS_TOKEN: "${ACCESS_TOKEN:-}"
      RUNNER_NAME: "${RUNNER_NAME_02:-proxmox-runner-02}"
      RUNNER_WORKDIR: "/_work"
      RUNNER_GROUP: "default"
      LABELS: "self-hosted,linux,x64,proxmox"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner-work-02:/_work

volumes:
  runner-work-01:
  runner-work-02:
```

> **Wichtiger Hinweis zum Image:** Verwenden Sie `ubuntu-noble` (Ubuntu 24.04 LTS). Das veraltete `latest` (Ubuntu 20.04) wird von modernen Versionen von Playwright und Node.js nicht mehr unterstützt.

### Inbetriebnahme auf dem Proxmox-Host:
1. **Token holen**:
   - **Option A (Empfohlen für Dauerbetrieb)**: GitHub Personal Access Token (Classic) mit Scope `repo` erzeugen und als `ACCESS_TOKEN` eintragen. Dieser läuft nicht nach 1 Stunde ab.
   - **Option B**: Auf GitHub unter **Settings** → **Actions** → **Runners** → **New runner** einen temporären Registrierungstoken kopieren und als `RUNNER_TOKEN` eintragen (Hinweis: Gilt 1 Stunde für Registrierungen).
2. **Starten**:
   ```bash
   # Beide Runner (01 und 02) starten:
   RUNNER_TOKEN="<DEIN_TOKEN>" docker compose -f docker/docker-compose.runner.yml up -d

   # Oder gezielt nur den zweiten Runner starten:
   RUNNER_TOKEN="<DEIN_TOKEN>" docker compose -f docker/docker-compose.runner.yml up -d github-runner-02

   # Logs prüfen:
   docker compose -f docker/docker-compose.runner.yml logs -f
   ```
3. Sobald `Listening for Jobs` in den Logs erscheint, ist der Runner aktiv und nimmt Jobs entgegen. Beide Runner bearbeiten Jobs vollkommen unabhängig und parallel.