# Deployment Guide

This guide explains how to deploy **Vinyl Tracker** to a server or another machine without transferring source code.

## 1. Prerequisites

The target machine must have:
- **Docker** and **Docker Compose** installed.
- **Git** (optional, not strictly required for registry deployment).

## 2. Building Images

The target machine needs access to the Docker images. You have two options:

### Option A: Automated via CI/CD (Recommended)
This project is configured with GitHub Actions to automatically build and push images to the **GitHub Container Registry (GHCR)**.

1.  Push your changes to the `main` branch.
2.  Wait for the "CI Pipeline" to complete successfully.
3.  The images will be available at:
    - `ghcr.io/<your-username>/vinyl-tracker-backend:latest`
    - `ghcr.io/<your-username>/vinyl-tracker-frontend:latest`

### Option B: Manual Build
If you want to push images manually execution from your development machine:

1.  **Login to your Registry**:
    ```bash
    docker login
    ```
2.  **Run the Build & Push Script**:
    ```bash
    # Replace 'myuser/' with your Docker Hub username or registry URL
    ./push-images.sh myuser/
    ```

## 3. Preparation (On Target Machine)

You only need **two files** on the target machine (plus certs if using local SSL):
1.  `docker-compose.registry.yml` (rename to `docker-compose.yml` for convenience).
2.  `.env` (configuration).

### Transfer Files
Copy these files via `scp`, SFTP, or USB to your server.

### Configuration (.env)
**Crucial Step**: Configure environment variables.

1.  Copy `.env.example` (or create a new `.env` file).
2.  Set secure passwords for `POSTGRES_PASSWORD` and verification keys.
3.  **Configure Registry Prefix**:
    - **For CI/CD (Option A)**:
      ```bash
      # Note the trailing slash!
      REGISTRY_PREFIX=ghcr.io/<your-github-username>/
      ```
    - **For Manual Push (Option B)**:
      ```bash
      REGISTRY_PREFIX=myuser/
      ```

## 4. Start the Application

Run the application using the registry configuration:

```bash
docker compose -f docker-compose.registry.yml up -d
```
*Note: This will pull the latest images from the registry defined in your `.env`.*

The application is now running on **Port 80** of the target machine.

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
