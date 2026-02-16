# Vinyl Tracker v1.1.1

A personal vinyl record tracking application that allows users to scan barcodes, identify records via Discogs, and log listening sessions.

## Architecture

The project follows a modern containerized micro-architecture:

### Frontend
- **Framework**: React (built with Vite)
- **Language**: TypeScript
- **Features**: 
  - Progressive Web App (PWA) capabilities for mobile usage.
  - Barcode scanning integration (using `html5-qrcode`).
  - Secure Context support via local SSL.

### Backend
- **Framework**: Spring Boot 4.0.2
- **Language**: Java 24
- **Database Access**: Spring Data JPA with Hibernate.
- **API**: RESTful endpoints for scanning, user management, and analytics.
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
    Open `.env` and set your own secure values for `VINYL_ENCRYPTION_PASSWORD` and `VINYL_ENCRYPTION_SALT`.

### 3. Start the Application

1. **Start infrastructure**:
   ```bash
   docker compose up --build -d
   ```

2. **Access the App**:
   - **Frontend**: [https://localhost:5173](https://localhost:5173) (or `https://<YOUR_IP>:5173`)
   - **Backend API**: [http://localhost:8080](http://localhost:8080)

## User Guide

### Account Setup
1. **Register**: Creates a new local account.
2. **Discogs Integration**: 
   - Go to **Settings**.
   - Enter your Discogs Username.
   - Enter your Discogs Personal Access Token (generate at Discogs -> Settings -> Developers).
   - Your token is securely encrypted using your login password.

## Development & Testing

### Frontend
Located in `/frontend`. configured with `.npmrc` to handle legacy peer dependencies automatically.

**Run Tests:**
```bash
cd frontend
npm install
npm test
```
*Note: Tests enforce >80% code coverage.*

### Backend
Located in `/backend`.

**Run Tests:**
```bash
cd backend
mvn verify
```
*Note: `mvn verify` runs unit/integration tests and enforcing >80% code coverage via JaCoCo.*

### CI/CD
The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that automatically:
- Builds and tests the Backend (Java 24/Maven).
- Builds and tests the Frontend (Node 20/Vite).
- Enforces >80% test coverage for both.
- Runs on every push to `main` and PRs.
