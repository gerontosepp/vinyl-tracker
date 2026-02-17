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

## 5. HTTPS & SSL (Important!)

**Barcode Scanning Requires HTTPS**
Browsers intentionally block camera access on "insecure" origins (HTTP), with the exception of `localhost`.

### Option A: Reverse Proxy with Domain (Recommended for Servers)
1.  Point your domain (e.g., `vinyl.example.com`) to the server's IP.
2.  Set up a Reverse Proxy (Nginx, Traefik, Caddy) in front of the container.
3.  Use **Let's Encrypt** for a free SSL certificate.

### Option B: Local SSL (mkcert)
For local network (LAN) access without a domain:
1.  Generate certificates for the server's IP via `mkcert`.
2.  Place them in the `certs/` folder on the target machine (mounted by docker-compose).
3.  Install the Root CA on client devices.
