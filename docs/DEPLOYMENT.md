# Deployment Anleitung

Diese Anleitung erklärt, wie Sie **Vinyl Tracker** auf einem Server oder auf einem anderen Gerät bereitstellen (deployen) können, ohne den Quellcode dorthin kopieren zu müssen.

## 1. Voraussetzungen

Die Zielmaschine benötigt:
- **Docker** und **Docker Compose** installiert.
- **Git** (optional, nicht zwingend erforderlich für das Deployment über eine Registry).

## 2. Images bauen

Die Zielmaschine benötigt Zugriff auf die Docker Images. Sie haben zwei Möglichkeiten:

### Option A: Automatisiert via CI/CD (Empfohlen)
Dieses Projekt ist mit GitHub Actions so konfiguriert, dass es automatisch Images baut und in die **GitHub Container Registry (GHCR)** pusht.

1.  Pushen Sie Ihre Änderungen in den `main` Branch.
2.  Warten Sie, bis die "CI Pipeline" erfolgreich abgeschlossen ist.
3.  Die Images sind dann verfügbar unter:
    - `ghcr.io/<ihr-benutzername>/vinyl-tracker-backend:latest`
    - `ghcr.io/<ihr-benutzername>/vinyl-tracker-frontend:latest`

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
wget https://raw.githubusercontent.com/gerontosepp-dev/AntiGrafity/develop/docker-compose.registry.yml -O docker-compose.yml
wget https://raw.githubusercontent.com/gerontosepp-dev/AntiGrafity/develop/.env.example -O .env
```
*(Alternativ können Sie die beiden Dateien natürlich auch via `scp`, SFTP oder USB-Stick auf Ihren Server kopieren).*

### Konfiguration (.env)
**Wichtiger Schritt**: Konfigurieren Sie die Umgebungsvariablen.

1.  Kopieren Sie die `.env.example` (oder erstellen Sie eine neue `.env` Datei).
2.  Setzen Sie sichere Passwörter für `POSTGRES_PASSWORD` und die Verschlüsselungs-Keys.
3.  **Registry Prefix konfigurieren**:
    - **Für CI/CD (Option A)**:
      ```bash
      # Beachten Sie den abschließenden Schrägstrich (Slash)!
      REGISTRY_PREFIX=ghcr.io/<ihr-github-benutzername>/
      ```
    - **Für manuelles Pushen (Option B)**:
      ```bash
      REGISTRY_PREFIX=meinbenutzer/
      ```

## 4. Anwendung starten

Starten Sie die Anwendung mit der Registry-Konfiguration:

```bash
docker compose -f docker-compose.registry.yml up -d
```
*Hinweis: Dies lädt die neuesten Images aus der Registry herunter, die Sie in Ihrer `.env` definiert haben.*

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
