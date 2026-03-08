# Vinyl Tracker v1.5.1

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
- **Framework**: Spring Boot 3.5.10
- **Language**: Java 21
- **Database Access**: Spring Data JPA with Hibernate.
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
- **QR Code Generation**: Generate a PDF with QR codes for your entire collection, sorted by artist.
- **Quick Logging**: Scan generated QR codes to instantly log a listen without searching.
- **Collection Management**: Search, filter (e.g., "Played Only"), and sort your vinyl catalog. Force a manual sync with Discogs at any time.
- **Modern UI**: Fully responsive, mobile-first design with dark mode, glassmorphism, and smooth micro-animations.
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
    - `JWT_SECRET` (A strong, base64 or alphanumeric key > 32 characters for securing user login sessions).

### 3. Start the Application

1. **Start Development Environment**:
   ```bash
   docker compose up --build -d
   ```
   *Features hot-reloading for frontend.*

2. **Start Production Environment**:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```
   *Optimized build, no hot-reloading, runs on port 80.*

   👉 **[See Detailed Deployment Guide](docs/DEPLOYMENT.md)** for server setup and HTTPS requirements.

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
Located in `/frontend`. Recommended to use `--legacy-peer-deps` when installing.

**Run Tests:**
```bash
cd frontend
npm install
npm test
```
*Note: Tests enforce >80% code coverage.*

**Available NPM Scripts:**
| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts the development server with hot-reloading |
| `npm run build` | Builds the application for production |
| `npm run preview` | Previews the production build locally |
| `npm run lint` | Runs ESLint to check for code quality issues |
| `npm run format` | Runs Prettier to format the codebase |
| `npm run test` | Runs unit and integration tests (Vitest) |
| `npm run test:e2e` | Runs end-to-end tests (Playwright) - requires local env running |
| `npm run prepare` | Sets up Husky git hooks |

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
- Builds and tests the Backend (Java 21/Maven).
- Builds and tests the Frontend (Node 20/Vite).
- Enforces >80% test coverage for both.
- Runs on every push to `main` and PRs.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
