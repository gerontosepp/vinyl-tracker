# Vinyl Tracker v2.2.0

A personal vinyl record tracking application that allows users to scan barcodes, identify records via Discogs, and log listening sessions.

Release history: [Release-Info](docs/Release-Info.md)

## Architecture

The project follows a modern containerized micro-architecture:

### Frontend
- **Framework**: Angular 19
- **Language**: TypeScript
- **Features**: 
  - Progressive Web App (PWA) capabilities for mobile usage.
  - Barcode scanning integration (using `html5-qrcode`).
  - Secure Context support via local SSL.

### Backend
- **Framework**: Spring Boot 4.1.0
- **Language**: Java 25
- **Database Access**: Spring Data JPA with Hibernate and **Flyway** for schema migrations.
- **API**: RESTful endpoints with **JWT (JSON Web Token)** authentication.
- **Integration**: Discogs API for record metadata.

### Database
- **System**: PostgreSQL 16
- **Persistence**: Data is persisted in a Docker volume (`postgres_data`).

### Infrastructure
- **Docker Compose**: Orchestrates the Frontend, Backend, and Database services.
- **CI/CD**: GitHub Actions pipeline for automated building and testing.

## Features

- **Barcode Scanning**: Scan vinyl barcodes to retrieve metadata from Discogs.
- **Multi-User Support**: Individual user accounts with personal Discogs collection integration.
- **Listening History**: Log when you listen to a record.
- **Analytics**: View most played records and listening trends.
- **Live Collection Insights**: Dashboard charts for Discogs collection value and genre breakdown via `/api/analytics/collection/value` and `/api/analytics/collection/genres`.
- **QR Code Generation**: Generate a PDF with QR codes for your entire collection, sorted by artist.
- **Quick Logging**: Scan generated QR codes to instantly log a listen without searching.
- **Collection Management**: Search, filter (e.g., "Played Only"), and sort your vinyl catalog. Force a manual sync with Discogs at any time.
- **Data Management**: Reset your entire listening history with a single click from Settings (with confirmation dialog to prevent accidental deletions).
- **Modern UI**: Fully responsive, mobile-first design with dark mode, glassmorphism, and smooth micro-animations.
- **Resilient API**: Robust Discogs integration with **Resilience4j** rate-limiting (60 req/min) and automatic retries with exponential backoff.
- **Performance Caching**: Optimized release metadata retrieval using **Caffeine** local caching.
- **Observability**: Built-in comprehensive API request and error logging tracking latency across the frontend and backend Docker containers.

## Deployment & Running

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- [mkcert](https://github.com/FiloSottile/mkcert) for local SSL certificates (required for webcam access).

### 1. Setup Local SSL (One-time setup)

To enable the webcam for barcode scanning, the app must run over HTTPS. We use `mkcert` to generate trusted local certificates.

1.  **Install mkcert**:
    ```bash
    brew install mkcert
    mkcert -install
    ```
2.  **Generate Certificates**:
    Run this in the project root to create certificates for localhost and your local IP:
    ```bash
    mkdir -p certs
    mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 127.0.0.1 ::1 <YOUR_LOCAL_IP>
    ```
    *Replace `<YOUR_LOCAL_IP>` with your actual IP address (e.g., `192.168.178.68`).*

3.  **Trust on Mobile**:
    To scan from your phone, send the `certs/rootCA.pem` file to your device (via AirDrop/Email) and install it as a trusted profile.

### 2. Setup Environment Variables

The application requires environment variables for configuration (database credentials, encryption keys).

1.  **Create .env file**:
    Copy the example file to `.env`:
    ```bash
    cp .env.example .env
    ```

2.  **Configure Secrets**:
    Open `.env` and set your own secure values:
    - `VINYL_ENCRYPTION_PASSWORD` and `VINYL_ENCRYPTION_SALT` (for Discogs token encryption).
    - `JWT_SECRET` (Required. Must be a strong key with at least 32 characters for securing user login sessions. Backend startup fails fast if missing/too short).
    - `CORS_ALLOWED_ORIGINS` (Comma-separated allowlist, e.g. `https://localhost:5173,https://127.0.0.1:5173`).
    - `CORS_ALLOW_CREDENTIALS` (`false` by default; set `true` only if cookie-based auth is required).
    - `IMAGE_PROXY_ALLOWED_HOSTS` (Comma-separated allowlist for `/api/proxy/image`, e.g. `i.discogs.com,s.discogs.com,api.discogs.com`).
    - `AUTH_COOKIE_NAME`, `AUTH_COOKIE_MAX_AGE_SECONDS`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAME_SITE` (controls the backend HttpOnly session cookie used for authentication).

    Authentication note: The frontend uses backend-managed HttpOnly cookies by default and supports a Bearer token fallback for environments where cookie propagation is constrained.
   
    API error note: Backend validation and runtime failures are returned as structured `ProblemDetail` JSON payloads.

### 3. Start the Application

1. **Start Development Environment**:
   ```bash
   docker compose up --build -d
   ```
   *Features hot-reloading for frontend. The backend will automatically wait for the `postgres` healthcheck to pass before starting.*

2. **Start Production Environment (or Proxmox / LXC)**:
   - **Automated Proxmox Deployment Script**:
     ```bash
     ./deploy_proxmox.sh [v2.2.0]
     ```
   - **Manual Compose**:
     ```bash
     docker compose -f docker-compose.prod.yml up --build -d
     ```
   *Optimized build, no hot-reloading, runs on port 80.*

   👉 **[See Detailed Deployment Guide](docs/DEPLOYMENT.md)** for server setup and HTTPS requirements.

   > [!IMPORTANT]
   > For the **first deployment** against an existing database, ensure `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` is set (this is already the default in `docker-compose.prod.yml`) to correctly baseline your schema.

2. **Access the App**:
   - **Frontend**: [https://localhost:5173](https://localhost:5173) (or `https://<YOUR_IP>:5173`)
   - **Backend API**: [http://localhost:8080](http://localhost:8080)
   - **API Docs (Swagger UI)**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) (OpenAPI spec at `/v3/api-docs`).
     > Interactive API docs are enabled in development only. They are disabled in production via `SPRINGDOC_API_DOCS_ENABLED=false` and `SPRINGDOC_SWAGGER_UI_ENABLED=false` (set in `docker-compose.prod.yml`).

## User Guide

### Account Setup
1. **Register**: Creates a new local account.
2. **Discogs Integration**: 
   - Go to **Settings**.
   - Enter your Discogs Username.
   - Enter your Discogs Personal Access Token (generate at Discogs -> Settings -> Developers).
   - Your token is securely encrypted using your login password.

## Development & Testing

### Data Management
1. **Force Sync Collection**: Manually sync your Discogs collection with the application. Located in **Settings** under "Data Management".
2. **Reset All Listens**: Permanently delete your entire listening history. Located in **Settings** under "Data Management". A confirmation dialog prevents accidental deletions.
    - **Warning**: This action cannot be undone and will delete all listening event records.

### Frontend
Located in `/frontend`.

**Run Tests:**
```bash
cd frontend
npm install
npm test
```
*Note: Tests enforce >80% code coverage for core services, utilities, and components.*

**Available NPM Scripts:**
| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts the Angular development server on port 5173 with proxy configuration |
| `npm run build` | Builds the application for production |
| `npm run test` | Runs unit tests (Karma/Jasmine) in headless mode |
| `npm run test:e2e` | Runs end-to-end tests (Playwright) - requires local env running |

Current high-risk regression coverage focuses on authentication, dashboard scanner access, and manual Discogs sync flows in Playwright plus backend negative-path tests for scan validation and ownership checks.

Architecture hardening: User endpoints use validated request DTOs, frontend error handling extracts typed unknown messages, and core features use modern Angular signals for reactive state management.

### Backend
Located in `/backend`.

**Run Unit Tests (fast local feedback):**
```bash
cd backend
mvn test
```

**Run Full Validation (unit + integration + coverage checks):**
```bash
cd backend
mvn verify
```
*Note: `mvn test` executes unit tests via Surefire. `mvn verify` additionally executes integration tests via Failsafe and enforces >80% code coverage via JaCoCo.*

**Test JVM Fork Shutdown Timeouts:**
- Unit tests (Surefire): `test.unit.forkedProcessExitTimeoutInSeconds` (default `30`)
- Integration tests (Failsafe): `test.integration.forkedProcessExitTimeoutInSeconds` (default `120`)

You can override them at runtime, for example:
```bash
mvn verify -Dtest.integration.forkedProcessExitTimeoutInSeconds=120
```

**Run Online Dependency Vulnerability Scan:**
```bash
cd backend
export OSSINDEX_USERNAME=<your-ossindex-username>
export OSSINDEX_TOKEN=<your-ossindex-token>
mvn -Psecurity-online verify
```
*The `security-online` Maven profile queries Sonatype OSS Index and writes a report to `backend/target/ossindex-audit.json`. The current configuration is non-blocking (`fail=false`), so findings are reported but do not fail the build.*

**Local Maven Authentication Setup:**
Create `~/.m2/settings.xml` with an `ossindex` server entry so Maven can use the credentials from your shell environment:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                    xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.2.0 https://maven.apache.org/xsd/settings-1.2.0.xsd">
    <servers>
        <server>
            <id>ossindex</id>
            <username>${env.OSSINDEX_USERNAME}</username>
            <password>${env.OSSINDEX_TOKEN}</password>
        </server>
    </servers>
</settings>
```

### CI/CD
The project includes GitHub Actions workflows:
- **CI Pipeline** (`.github/workflows/ci.yml`):
  - Automatically builds and tests the Backend (Java 25/Maven).
  - Builds and tests the Frontend (Node 20/Angular, Karma headless).
  - Enforces >80% test coverage for both.
  - Runs the backend online dependency vulnerability audit through the `security-online` Maven profile.
  - Runs on push and pull requests for `main`, `master`, and `develop`, plus release tags `v*.*.*` (which triggers building and pushing Docker images to GHCR).
- **Auto Release** (`.github/workflows/release.yml`):
  - Automatically creates a GitHub Release (with tag `v<version>` from `frontend/package.json` and auto-generated release notes) when a Pull Request to `main` is successfully merged.
  - Creating a release triggers the CI Pipeline's tag build, automatically publishing the new Docker images.

Required GitHub Actions secrets for the backend security audit:
- `OSSINDEX_USERNAME`
- `OSSINDEX_TOKEN`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
