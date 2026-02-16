# Vinyl Tracker

A personal vinyl record tracking application that allows users to scan barcodes, identify records via Discogs, and log listening sessions.

## Architecture

The project follows a modern containerized micro-architecture:

### Frontend
- **Framework**: React (built with Vite)
- **Language**: TypeScript
- **Features**: 
  - Progressive Web App (PWA) capabilities for mobile usage.
  - Barcode scanning integration.
  - Responsive design.

### Backend
- **Framework**: Spring Boot 4.0.2
- **Language**: Java 25 (LTS)
- **Database Access**: Spring Data JPA with Hibernate.
- **API**: RESTful endpoints for scanning, user management, and analytics.
- **Integration**: Discogs API for record metadata.

### Database
- **System**: PostgreSQL 16
- **Persistence**: Data is persisted in a Docker volume (`postgres_data`).

### Infrastructure
- **Docker Compose**: Orchestrates the Frontend, Backend, and Database services.
- **Networking**: Internal bridge network for service communication.

## Features

- **Barcode Scanning**: Scan vinyl barcodes to retrieve metadata from Discogs.
- **Multi-User Support**: Individual user accounts with personal Discogs collection integration.
- **Listening History**: Log when you listen to a record.
- **Analytics**: View most played records and listening trends (in development).

## Deployment & Running

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Quick Start

1. **Clone the repository** (if not already done).
2. **Navigate to the project root**:
   ```bash
   cd vinyl-tracker
   ```
3. **Start the application**:
   ```bash
   docker compose up --build -d
   ```

### Accessing the App

- **Frontend**: [http://localhost:5173](http://localhost:5173) (or configured port)
- **Backend API**: [http://localhost:8080](http://localhost:8080)

### Configuration

Environment variables and database credentials are configured in `docker-compose.yml` and `application.properties`.

## User Guide

### 1. Generating a Discogs Token
To use the application, you need a Discogs account and a Personal Access Token. This token allows the app to search your collection and fetch release data on your behalf.

1. **Log in** to your [Discogs account](https://www.discogs.com/).
2. Go to **Settings** > **Developers**.
3. Click on the button **Generate new token**.
4. Copy the generated token string. You will need this to log in to the Vinyl Tracker app.

### 2. Logging In
1. Open the Vinyl Tracker app in your browser.
2. Enter your **Discogs Username**.
3. Paste your **Discogs Token** into the password field.
4. Click **Login**.

The app will verify your credentials against the Discogs API. Once logged in, your session is saved locally, and you can start scanning!

## Development

- **Backend**: Located in `/backend`. Run with Maven or your IDE.
- **Frontend**: Located in `/frontend`. Run with `npm run dev`.



