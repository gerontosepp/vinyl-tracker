# Deployment Anleitung

Diese Anleitung erklärt, wie Sie **Vinyl Tracker** auf einem Server oder auf einem anderen Gerät bereitstellen (deployen) können, ohne den Quellcode dorthin kopieren zu müssen.

## 1. Voraussetzungen

Die Zielmaschine benötigt:
- **Docker** und **Docker Compose** installiert.
- **Git** (optional, nicht zwingend erforderlich für das Deployment über eine Registry).

## 2. Images bauen

Die Zielmaschine benötigt Zugriff auf die Docker Images. Sie haben zwei Möglichkeiten:

### Option A: Automatisiert via CI/CD (Empfohlen)
Dieses Projekt ist mit GitHub Actions so konfiguriert, dass es automatisch Images baut und in die **GitHub Container Registry (GHCR)** pusht, sobald ein neues Release erstellt wird.

Voraussetzung für den Backend-Build in CI ist zusätzlich ein Online-Dependency-Scan via Sonatype OSS Index. Dafür müssen im GitHub-Repository diese **Actions Secrets** gesetzt sein:
- `OSSINDEX_USERNAME`
- `OSSINDEX_TOKEN`

Zusätzlich wird der Backend-Job mit `mvn clean verify -Psecurity-online` ausgeführt. Dabei laufen Unit-Tests (Surefire) und Integrationstests (Failsafe). In CI wird für den Integrations-Shutdown explizit ein robuster Timeout gesetzt:
- `-Dtest.integration.forkedProcessExitTimeoutInSeconds=120`

1.  Mergen Sie Ihre fertigen Features aus `develop` in den `main` Branch.
2.  Erstellen Sie auf GitHub ein **neues Release** (z.B. `v1.7.0`), das auf den `main` Branch zeigt.
3.  Warten Sie, bis die "CI Pipeline" für dieses Tag erfolgreich abgeschlossen ist.
4.  Die Images sind dann mit dem entsprechenden Versions-Tag sowie als `latest` verfügbar unter:
    - `ghcr.io/<ihr-benutzername>/vinyl-tracker-backend:latest` (oder `:v1.7.0`)
    - `ghcr.io/<ihr-benutzername>/vinyl-tracker-frontend:latest` (oder `:v1.7.0`)

### Option B: Manueller Build
Wenn Sie die Images manuell von Ihrem Entwicklungsrechner pushen möchten:

1.  **Beim Registry-Anbieter einloggen**:
    ```bash
    docker login
    ```
2.  **Das Build & Push Skript ausführen**:
    ```bash
    # Ersetzen Sie 'meinbenutzer/' durch Ihren Docker Hub Benutzernamen oder die Registry-URL
    ./push-images.sh meinbenutzer/
    ```

## 3. Vorbereitung (Auf der Zielmaschine)

Sie benötigen lediglich **zwei Dateien** auf der Zielmaschine (plus Zertifikate, falls Sie lokales SSL nutzen):
1.  `docker-compose.registry.yml` (zur Vereinfachung in `docker-compose.yml` umbenennen).
2.  `.env` (Konfiguration).

### Dateien übertragen
Sie können diese Dateien herunterladen, ohne das gesamte Git-Repository clonen zu müssen. Führen Sie auf Ihrem Server einfach folgende Befehle aus:

```bash
wget https://raw.githubusercontent.com/gerontosepp/vinyl-tracker/develop/docker-compose.registry.yml -O docker-compose.yml
wget https://raw.githubusercontent.com/gerontosepp/vinyl-tracker/develop/.env.example -O .env
```
*(Alternativ können Sie die beiden Dateien natürlich auch via `scp`, SFTP oder USB-Stick auf Ihren Server kopieren).*

### Konfiguration (.env)
**Wichtiger Schritt**: Konfigurieren Sie die Umgebungsvariablen.

1.  Kopieren Sie die `.env.example` (oder erstellen Sie eine neue `.env` Datei).
2.  Setzen Sie ein sicheres Passwort für `POSTGRES_PASSWORD` und `VINYL_ENCRYPTION_PASSWORD`.
3.  **Wichtig für den Salt & JWT:** 
    - Der `VINYL_ENCRYPTION_SALT` **MUSS** ein gültiger Hexadezimal-String sein (z.B. 16 Zeichen).
    - Der `JWT_SECRET` **MUSS** ein sicheres, langes Passwort (mindestens 32 Zeichen) zur Session-Sicherung sein.
4.  **Registry Prefix konfigurieren**:
    - **Für CI/CD (Option A)**:
      ```bash
      # Beachten Sie den abschließenden Schrägstrich (Slash)!
      REGISTRY_PREFIX=ghcr.io/<ihr-github-benutzername>/
      ```
        - **CI-Secrets prüfen**:
            Stellen Sie sicher, dass `OSSINDEX_USERNAME` und `OSSINDEX_TOKEN` im GitHub-Repository unter Settings -> Secrets and variables -> Actions hinterlegt sind, damit der Backend-Job erfolgreich durchläuft.
    - **Für manuelles Pushen (Option B)**:
      ```bash
      REGISTRY_PREFIX=meinbenutzer/
      ```
5.  **Datenbank-Migrationen & Flyway Baselining**:
    Wenn Sie die Anwendung gegen eine bereits existierende Datenbank deployen, stellen Sie sicher, dass `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` in Ihrer `.env` oder der Compose-Datei gesetzt ist (standardmäßig in `docker-compose.registry.yml` und `docker-compose.prod.yml` aktiviert), um die Datenbank korrekt zu initialisieren.
6.  **OpenAPI / Swagger-Dokumentation**:
    In Produktionsumgebungen ist die API-Dokumentation standardmäßig deaktiviert, um API-Details nicht ungeschützt offenzulegen. Gesteuert wird dies über die Umgebungsvariablen:
    - `SPRINGDOC_API_DOCS_ENABLED=false`
    - `SPRINGDOC_SWAGGER_UI_ENABLED=false`
7.  **Strukturiertes JSON-Logging**:
    Durch das Setzen von `SPRING_PROFILES_ACTIVE=prod` in der Docker Compose Konfiguration wird die Logausgabe des Backends auf JSON-Format umgestellt. Dies erleichtert das automatische Einlesen, Filtern und Durchsuchen der Logs durch Log-Aggregatoren (z.B. Loki, Logstash, Fluentd).

## 4. Anwendung starten

### Option A: Automatisiertes Deployment-Skript (Empfohlen für Proxmox / LXC / VMs)
Nutzen Sie das bereitgestellte Skript `./deploy_proxmox.sh` für die automatische Erstellung sicherer `.env`-Geheimnisse, das Herunterladen der aktuellen Docker-Images und die Ausführung des Healthchecks:

```bash
# Neuestes Release (latest) installieren/aktualisieren:
./deploy_proxmox.sh

# Ein spezifisches Release installieren:
./deploy_proxmox.sh v2.1.3
```

### Option B: Manuelles Docker Compose
Starten Sie die Anwendung manuell mit der Registry-Konfiguration:

```bash
docker compose -f docker-compose.registry.yml up -d
```

*Images werden standardmäßig als `latest` gezogen.*

Die Anwendung läuft nun auf **Port 80** der Zielmaschine.

## 5. Deployment hinter einem Reverse Proxy (z.B. Proxmox)

Für den produktiven Einsatz auf einem Server (z.B. als Docker-VM unter Proxmox) wird ein vorgeschalteter **Reverse Proxy** (wie Nginx Proxy Manager, Traefik oder Caddy) dringend empfohlen. Dieser übernimmt das SSL-Zertifikatsmanagement zentral für alle Dienste, sodass `mkcert` überflüssig wird.

> **Wichtig:** Barcode-Scanning benötigt für den Kamerazugriff zwingend eine gültige `HTTPS`-Verbindung (Secure Context). Andernfalls blockieren Handy-Browser die Kamera kommentarlos!

### So funktioniert das Setup mit Nginx Proxy Manager (NPM):

1. **Domain einrichten**: Richte eine DynDNS- oder Sub-Domain ein (z.B. `vinyl.meinedomain.de`), die auf deinen Heimrouter/Server zeigt.
2. **Vinyl Tracker starten**: Führe `docker compose -f docker-compose.prod.yml up -d` aus (oder die `registry.yml` Variante). Der Frontend-Container läuft nun lokal isoliert auf Port `80`.
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

Ab jetzt erreicht jedes Gerät (auch dein Smartphone) die App über `https://vinyl.meinedomain.de` mit einem zu 100% gültigen und vertrauenswürdigen Zertifikat. Der Kamera-Zugriff für das Barcode-Scanning wird ohne Warnungen gestattet!

### Lokales Setup / Entwicklung (Ohne Domain)
Für die reine Entwicklung auf einem lokalen Laptop ohne eigene Domain wird weiterhin `docker-compose.yml` (`npm run dev`) zusammen mit `mkcert` verwendet, da hier kein Reverse Proxy zur Verfügung steht, der Let's Encrypt Zertifikate validieren könnte. (Siehe Haupt-README).