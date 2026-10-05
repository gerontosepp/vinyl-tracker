---
name: proxmox-deployment
description: >-
  Standardized runbook for deploying, upgrading, and troubleshooting Vinyl Tracker
  on Proxmox (LXC / VM), Docker servers, or behind reverse proxies like Nginx Proxy Manager.
---

# Vinyl Tracker Proxmox Deployment Skill

This skill provides operational procedures for deploying, upgrading, and diagnosing Vinyl Tracker on Proxmox LXC/VM environments.

## 1. Quick Deployment via Script

Use [`deploy_proxmox.sh`](../../../scripts/deploy_proxmox.sh) for automated rollout:

```bash
# Deploy latest release:
./scripts/deploy_proxmox.sh

# Or deploy a pinned release tag:
./scripts/deploy_proxmox.sh v2.4.1
```

The script automatically:
1. Verifies Docker and Docker Compose availability.
2. Generates secure random passwords for Postgres, AES encryption, and JWT secret if no `.env` exists.
3. Pulls published public images from `ghcr.io/gerontosepp/` (no Docker login required).
4. Deploys using `docker/docker-compose.registry.yml`.
5. Waits for healthchecks to pass on Postgres and Backend.

## 2. Environment Configuration Checklist (`.env`)

Before running in production, verify the following configuration values:

| Variable | Requirement | Purpose |
| :--- | :--- | :--- |
| `POSTGRES_PASSWORD` | Strong password | Secures PostgreSQL database |
| `VINYL_ENCRYPTION_PASSWORD` | Strong password | Used to encrypt Discogs personal tokens |
| `VINYL_ENCRYPTION_SALT` | Valid hex string (e.g. 16/32 chars) | Salt for PBKDF2 key derivation |
| `JWT_SECRET` | ≥ 32 characters | HMAC-SHA256 signature key for auth cookies / tokens |
| `CORS_ALLOWED_ORIGINS` | e.g. `https://vinyl.example.com` | Allowed browser origins |
| `IMAGE_TAG` | `latest` or `vX.Y.Z` | Controls image version pulled from registry |
| `REGISTRY_PREFIX` | `ghcr.io/gerontosepp/` | Container registry prefix |

## 3. Reverse Proxy & HTTPS Requirements

> **Critical Note:** Mobile browsers require a **Secure Context (`HTTPS`)** to grant camera access for barcode scanning. Deploying behind a reverse proxy is mandatory for mobile scanner usage.

### Nginx Proxy Manager (NPM) Setup:
1. **Proxy Host**: Forward domain (e.g., `vinyl.yourdomain.de`) to the Proxmox VM/LXC internal IP on port `80`.
2. **Websockets**: Enable Websockets support.
3. **SSL**: Request Let's Encrypt certificate with "Force SSL" enabled.

## 4. Operational Diagnosis & Troubleshooting

### Check Container Status
```bash
docker compose -f docker/docker-compose.registry.yml ps
```

### View Application Logs
```bash
# Backend logs (JSON structured in production):
docker compose -f docker/docker-compose.registry.yml logs -f backend

# Frontend (Nginx access & error logs):
docker compose -f docker/docker-compose.registry.yml logs -f frontend

# Database logs:
docker compose -f docker/docker-compose.registry.yml logs -f postgres
```

### Restart Services
```bash
docker compose -f docker/docker-compose.registry.yml restart
```
