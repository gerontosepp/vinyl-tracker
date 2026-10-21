# Vinyl Tracker v0.13.0

A personal vinyl record tracking application that allows users to scan barcodes, identify records via Discogs, and log listening sessions.

Release history: [Release-Info](docs/Release-Info.md) | Architecture: [arc42](docs/arc42.md) | [ADRs](docs/adr/README.md) | [OpenSpec](openspec/) | [Rust-Migration Lastenheft](docs/rust-migration-lastenheft.md)

## Architecture

The project follows a modern containerized micro-architecture:

### Frontend
- **Framework**: Angular 22
- **Language**: TypeScript
- **Features**: 
  - Progressive Web App (PWA) capabilities for mobile usage.
  - Barcode scanning integration (using `html5-qrcode`).
  - Secure Context support via local SSL.

### Backend
- **Framework / Runtime**: Axum 0.8, Tokio 1.x, Tower-HTTP
- **Language**: Rust (2024 edition)
- **Database Access**: PostgreSQL via `sqlx` with automatic, embedded migrations (`sqlx::migrate`, files `backend/migrations/<n>_<name>.sql`; existing refinery/Flyway histories are imported automatically)
- **Features**: JWT-Auth (HMAC-SHA256 tokens, BCrypt password hashing), AES-256-GCM encryption of Discogs tokens (PBKDF2-derived key), Discogs REST Client with rate-limiting (`governor`) & caching (`moka`), SSRF-protected image proxy, Roon MOO WebSocket Engine & SOOD discovery, native vector-based QR-Code & PDF generation (`fast_qr`, `printpdf`).
- **Location**: `backend/` directory.

### Database
- **System**: PostgreSQL 16
- **Persistence**: Data is persisted in a Docker volume (`postgres_data`).

### MCP Server (AI Integration)
- **Language**: Rust
- **Framework**: `rmcp` (v3.5) official MCP SDK
- **Communication**: REST client against the Backend over stdio JSON-RPC.
- **API Contract**: Request/response types are shared with the backend via the crate `vinyl-api-types` (`backend/crates/vinyl-api-types`), so MCP and backend always agree on the JSON format. Use an MCP binary built from the same version as the backend.
- **Location**: `mcp/` directory.

### Infrastructure
- **Docker Compose**: Orchestrates the Frontend, Backend, and Database services.
- **CI/CD**: GitHub Actions pipeline for automated building and testing.

## Features

- **Eyoyo EY-009P & Hardware Scanner Support**: Seamless, hands-free 1D barcode and 2D QR code scanning via global HID Keyboard Wedge listener. Configurable scanner modes (*Externer Hardware-Scanner*, *Interner Kamera-Scanner*, *Hybrid*), optional audio feedback (beep), live scanner testing area in Settings, and battery-friendly operation (camera stays powered off in hardware mode).
- **Model Context Protocol (MCP)**: Native Rust MCP server with 26 tools, `vinyl://` resources and prompts to query and manage your vinyl collection, add releases, update Goldmine condition grading, refresh market values, inspect Roon status and audio zones, trigger local Roon playback, get random recommendations, view unplayed records, fetch album tracklists, search Discogs, log listen events directly or via barcode, and inspect analytics from AI assistants (Antigravity IDE, Claude Desktop, Cursor).
- **Roon Control & Local Playback**: Direct integration with the official Roon API (WebSocket MOO/1 protocol). Configure your local Roon Core in Settings, select playback zones, and trigger playback ("Auf Roon abspielen" / Play Now) directly from the record detail modal or via the MCP tool `play_record_on_roon`.
- **Random Record Recommendations**: Get random vinyl suggestions (`/api/collection/random`) with optional genre filter and "unplayed only" mode.
- **Unplayed Records ("Shelf of Shame")**: Dedicated endpoint (`/api/collection/unplayed`) to quickly find and listen to albums you have never played.
- **Detailed Album Metadata**: Complete record details (`/api/records/{id}`) including tracklist, formats, labels, release notes, and personal play counts.
- **Condition Grading & Discogs Sync**: Inspect and edit media and sleeve condition directly in the album detail modal via Goldmine grading dropdowns (`Mint (M)`, `Near Mint (NM or M-)`, `Very Good Plus (VG+)`, etc.). Changes are saved locally and synced to Discogs collection custom fields (`PATCH /api/records/{id}/condition`). Updating media condition automatically recalculates the estimated market value based on condition-specific price suggestions.
- **Global Discogs Search**: Direct database search (`/api/discogs/search`) for exploring albums, artists, and releases.
- **Smart Barcode Scanning & Discogs Auto-Add**: Scan vinyl barcodes or custom QR codes to instantly log listens. If a scanned record is not yet in your collection, Vinyl Tracker searches Discogs, previews pressing details with variant selection, and adds it directly to your Discogs collection (`POST /api/collection/releases/{id}`) followed by automatic library synchronization.
- **Multi-User Support**: Individual user accounts with personal Discogs collection integration.
- **Listening History & Just Listening**: Log listening sessions via barcode/QR scan or directly via the **"Höre ich gerade" (Just listening)** button in the album detail view.
- **Analytics**: View most played records and listening trends.
- **Record Details from the Dashboard**: Click a cover in "Zuletzt gehört" or "Meistgespielte Alben" to open the same detail view as in the collection (tracklist, conditions, value, listening history, log a listen, play on Roon, remove); the lists refresh after changes. `GET /api/analytics/top` returns the `discogsId` of each record.
- **Most Played Artists**: The "Meistgespielt / Most Played" block on the dashboard switches between **Albums** and **Artists**. The artists tab ranks the top 10 artists of the chosen period by listens, with the number of albums played and a small collage of their most played covers; a click opens the collection searched for the artist (`/collection?search=…`, `GET /api/analytics/top-artists`, MCP tool `get_top_artists`).
- **Live Collection Insights**: Dashboard charts for Discogs collection value (in EUR `€` via `/api/analytics/collection/value?curr_abbr=EUR` with median, min, max) and genre breakdown via `/api/analytics/collection/genres`.
- **Print Module (Labels & Lists)**: Print from Settings (entire collection) or the Collection view (selected records or current filters) via a print dialog (`POST /api/print`). Templates: **Avery Zweckform 6605/3474 QR labels** (70 × 37 mm, 24 per A4 sheet, start at any label 1–24 for partially used sheets), **scan list** (table with one scannable QR code per record to log listens from paper), **QR cards** (9 per page to cut out) and **inventory list** (checklist grouped by shelf and compartment, records without space last). Print at 100 % / actual size so the labels line up.
- **Shelf Storage (Kallax & CD shelves)**: Switch the collection to **Regale / Shelves** and describe your storage via **Regale verwalten / Manage shelves**: storage types with a compartment grid and capacity per compartment in discs (presets for IKEA Kallax 1×4, 2×2, 2×4, 4×4, 5×5 with 70 records and the IKEA CD shelf 12×1 with 11 CDs) and your shelves per medium in order. The tracker spreads the collection (artist A–Z, then year and title) evenly over all compartments and stores the compartment boundaries. New records – added in the app or via the Discogs sync – go into the compartment whose range they fall into; other records only move when a compartment overflows, and then just to the nearest compartment with space. After adding a record you see where it belongs (shelf, compartment, row/column, neighbors) and which records move. The collection table, the mobile list and the record details show the location; the overview shows every shelf as a grid with fill level and artist range and offers **Redistribute** with a preview. Double LPs and box sets take as many places as they have discs. Click a compartment (or the records without space) to open the filtered list, or filter the collection by **location** in the toolbar (`storage_unit`, `compartment`); the filter also applies to printing. The MCP tools `get_record_placement` and `get_storage_layout` answer "where does this record go?" from AI assistants, and the JSON backup includes the shelf configuration. On phones, a minimal **sort mode** (`/sort`) guides you record by record through the shelves from any start compartment (`/api/storage/...`, ADR-0020).
- **Collection Backup & Insurance Export**: Comprehensive backup and export tools for your library (`GET /api/collection/export?format=csv|json|pdf`). Export full collections in **CSV** (RFC-4180-compliant tabular format for spreadsheets), **JSON** (complete structured backup incl. full listening history and the shelf configuration, `format_version: 3`), or **PDF** (printable catalog & insurance documentation with valuation summary banner, total estimated market values, Goldmine condition gradings, and artwork covers). Available in Settings under Data Management.
- **Collection Restore from JSON Backup**: Restore a JSON backup in Settings under Data Management (`POST /api/collection/restore`). The backup is merged into the collection and can be imported repeatedly without creating duplicates: nothing is deleted, conditions from the backup win, and listening events are deduplicated. Older backups (without `format_version: 2`) contain no listening history, so only records and conditions are restored. Shelves from a backup (`format_version: 3`) are added by name if missing; existing storage types and shelves stay unchanged, and their compartment boundaries are only restored for media without shelves.
- **Quick Logging**: Scan generated QR codes to instantly log a listen without searching.
- **Collection Management & Values**: Search, filter by format category ("Alle", "Platten" [inkl. Einzel-/Doppel-LP], "CDs" [inkl. Einzel-/Doppel-CD]), filter by multi-select **Genre** (z. B. Rock, Jazz mit dynamischer Häufigkeitsanzeige), filter nach **Erscheinungsjahr / Zeiträumen** (einzelne Jahre wie `1970, 1971`, Von-Bis-Bereiche wie `1970-1972` oder Kombinationen daraus), toggle **"Played Only"** oder **"Nicht gespielt..."** (Stichtagsfilterung nach Datum oder Schnellfilter „Noch nie gespielt“), and sort your collection catalog. Displays the estimated market value and play count alongside the **"Last played at" / "Zuletzt gespielt"** timestamp for records in the list. Intuitive table column interactions: clicking cover, title, or artist opens the rich detail modal (tracklists, formats, labels, notes, listening history), column 1 toggles QR print selection, and clicking the Discogs ID opens the external release page in a new tab. All date fields dynamically adapt to the active locale (`de-DE` / `en-US`). Force a manual sync with Discogs at any time (automatically populates missing market values and recalculates prices when conditions change). Albums can be removed directly from the collection and the linked Discogs folder via **"Aus Sammlung entfernen"** in the album detail view (`DELETE /api/collection/releases/{id}`) with safety confirmation.
- **Data Management**: Reset your entire listening history with a single click from Settings (with confirmation dialog to prevent accidental deletions).
- **In-App Release Notes & Changes**: Transparent in-app changelog in Profile & Settings displaying release highlights, bug fixes, and milestones directly from `docs/Release-Info.md` with interactive version accordions and live search.
- **Modern UI**: Fully responsive, mobile-first design with the warm "Vinyl" color scheme (amber accent; dark mode in warm brown-black), light/dark/system mode applied from the first page load, glassmorphism, and smooth micro-animations.
- **Resilient API**: Discogs integration with client-side rate limiting via `governor` (60 req/min) and server-side request timeouts.
- **Performance Caching**: In-memory caching via `moka` for Discogs release metadata (24 h), price suggestions (1 h) and proxied cover images (24 h).
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
    Open `.env` and set your own secure values for at least `JWT_SECRET`, `VINYL_ENCRYPTION_PASSWORD`, `VINYL_ENCRYPTION_SALT` and `POSTGRES_PASSWORD`. All backend settings:

    | Variable | Default | Purpose |
    | :--- | :--- | :--- |
    | `JWT_SECRET` | dev key (rejected if `APP_ENV=production`) | **Required**, >= 32 characters; startup fails if shorter. |
    | `JWT_EXPIRATION_SECS` | `604800` (7 days) | Lifetime of issued JWTs. The session also ends when the auth cookie expires (`AUTH_COOKIE_MAX_AGE_SECONDS`). |
    | `VINYL_ENCRYPTION_PASSWORD` / `VINYL_ENCRYPTION_SALT` | insecure built-in dev values | Key material for encrypting Discogs tokens (AES-256-GCM). **Set in production**; changing them makes stored tokens unreadable. |
    | `APP_ENV` (alias `ENVIRONMENT`) | `development` | `production` enables `Secure` cookies by default and rejects the dev `JWT_SECRET`. |
    | `HOST` / `PORT` | `0.0.0.0` / `8080` | Bind address of the backend. |
    | `DATABASE_URL` | built from `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST` (`localhost`), `POSTGRES_PORT` (`5432`) | PostgreSQL connection. |
    | `DATABASE_MAX_CONNECTIONS` / `DATABASE_MIN_CONNECTIONS` | `20` / `5` | Connection pool size. |
    | `DATABASE_ACQUIRE_TIMEOUT_SECS` / `DATABASE_IDLE_TIMEOUT_SECS` | `5` / `600` | Pool timeouts. |
    | `DATABASE_CONNECT_RETRIES` / `DATABASE_CONNECT_RETRY_INTERVAL_SECS` | `15` / `2` | Connection retries at startup. |
    | `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,https://localhost:5173,http://localhost:3000,http://127.0.0.1:5173` | Comma-separated allowlist (no wildcard). |
    | `CORS_ALLOW_CREDENTIALS` | `true` | Must stay `true`: the frontend authenticates with the HttpOnly session cookie. |
    | `AUTH_COOKIE_NAME` / `AUTH_COOKIE_MAX_AGE_SECONDS` | `vinyl_token` / `86400` | HttpOnly session cookie. |
    | `AUTH_COOKIE_SECURE` / `AUTH_COOKIE_SAME_SITE` | `true` if `APP_ENV=production`, else `false` / `Lax` | Cookie flags (`Secure` requires HTTPS). |
    | `AUTH_COOKIE_PATH` / `AUTH_COOKIE_DOMAIN` | `/` / unset | Cookie scope. |
    | `AUTH_RATE_LIMIT_FOR_PERIOD` | `10` | Auth requests per minute per client IP (login, register, reset-password). |
    | `TRUSTED_PROXIES` | empty (headers ignored) | Comma-separated IPs/CIDRs whose `X-Forwarded-For` / `X-Real-IP` are trusted. Production compose files set `172.16.0.0/12,192.168.0.0/16` for the bundled nginx ([ADR-0016](docs/adr/0016-vertrauenswuerdige-proxies-fuer-client-ip-ermittlung.md)). |
    | `REQUEST_TIMEOUT_SECS` / `LONG_REQUEST_TIMEOUT_SECS` | `30` / `300` | Server-side request timeouts; the long one applies to Discogs sync, price refresh, export/restore and QR-code PDFs. |
    | `IMAGE_PROXY_ALLOWED_HOSTS` | `i.discogs.com,s.discogs.com,api.discogs.com` | Allowlist for `/api/proxy/image` (SSRF protection). |
    | `DISCOGS_USER_AGENT` / `DISCOGS_API_BASE_URL` | `VinylTracker/1.0 (+https://github.com/gerontosepp/vinyl-tracker)` / `https://api.discogs.com` | Discogs client settings. |
    | `RUST_LOG` | `backend_rs=info,tower_http=info,axum=info` | Log filter (`tracing`). |

    Authentication note: The frontend uses backend-managed HttpOnly cookies by default and supports a Bearer token fallback for environments where cookie propagation is constrained. Public auth endpoints (`/login`, `/register`, `/reset-password`) are protected against brute force via per-client-IP rate limiting (`governor`), and enforce a minimum password length of 8 characters.
   
    API error note: Backend validation and runtime failures are returned as structured `ProblemDetail` JSON payloads. Rate limit violations return HTTP 429 (`Too Many Requests`), request timeouts HTTP 503 (`Service Unavailable`). On `SIGTERM` (e.g. `docker stop`) the backend shuts down gracefully and lets in-flight requests finish.

### 3. Start the Application

1. **Start Development Environment**:
   ```bash
   docker compose up --build -d
   ```
   *Features hot-reloading for frontend. The backend will automatically wait for the `postgres` healthcheck to pass before starting.*

2. **Start Production Environment (or Proxmox / LXC)**:
   - **Automated Proxmox Deployment Script** (pulls official public images from GHCR):
     ```bash
     ./scripts/deploy_proxmox.sh [v0.7.0]
     ```
   - **Manual Compose with Public Registry Images**:
     ```bash
     docker compose -f docker/docker-compose.registry.yml up -d
     ```
   - **Production Compose Build**:
     ```bash
     docker compose -f docker/docker-compose.prod.yml up --build -d
     ```
   *Optimized build, no hot-reloading, runs on port 80. Backend (`8080`) and PostgreSQL (`5432`) are only published on `127.0.0.1`; external clients must use the nginx endpoint (`http://<host>/api`).*

   👉 **[See Detailed Deployment Guide](docs/DEPLOYMENT.md)** for server setup, public images, and HTTPS requirements.

3. **Access the App**:
   - **Development** (`docker compose up`): Frontend [https://localhost:5173](https://localhost:5173) (or `https://<YOUR_IP>:5173`), Backend API [http://localhost:8080](http://localhost:8080).
   - **Production compose**: Frontend and API via nginx on port 80 (`http://<host>/`, API under `http://<host>/api`); terminate HTTPS in front of it (see [DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## User Guide

### Account Setup
1. **Register**: Creates a new local account.
2. **Discogs Integration**: 
   - Go to **Settings**.
   - Enter your Discogs Username.
   - Enter your Discogs Personal Access Token (generate at [Discogs Settings -> Developers](https://www.discogs.com/settings/developers)).
   - Your token is securely encrypted using your login password.

### Roon Integration & Local Playback
1. **Connect Roon Core**:
   - Navigate to **Settings** $\rightarrow$ **Roon Integration**.
   - Enter your Roon Core IP or hostname and Port (default: `9330` for Roon 2.0 / Roon OS).
   - Click **Save Roon Settings**.

### Shelf Storage
1. Open the **Collection**, switch to **Regale / Shelves** and add a storage type, e.g. the preset **Kallax 2×4** (8 compartments, 70 records each – stay a little below the physical maximum so new records fit).
2. Add your shelves in the order they stand, e.g. *Kallax-1*, *Kallax-2*. The first shelf distributes your collection immediately; adding, removing or reordering shelves redistributes automatically.
3. Sort your records into the compartments as shown in the overview. From now on, adding a record tells you exactly where it goes and which records have to move.
4. To check a compartment, click it in the overview (or pick it in the toolbar's location filter) and print the **inventory list** from the print dialog to tick off the records on paper.
5. To (re)sort a stack of records on your phone, tap the shelf icon (**Sammlung sortieren / Sort collection**) in the bottom bar, choose the shelf and the start compartment (row:column) and step through the records with **Weiter / Next** – the screen shows cover, title, artist, compartment and the position within it, highlights every new compartment and stays on while sorting.

### Hardware Scanner Setup (Eyoyo EY-009P)
Vinyl Tracker supports handheld 2D barcode imagers like the **Eyoyo EY-009P** out of the box via HID keyboard emulation:
1. **Connection**: Pair the Eyoyo EY-009P via Bluetooth HID, 2.4 GHz USB Dongle, or USB cable.
2. **Scanner Mode**:
   - In **Settings $\rightarrow$ Barcode & QR Scanner**, choose **Externer Hardware-Scanner (Eyoyo EY-009P / HID)**.
   - In this mode, the webcam remains deactivated (saving CPU/battery and avoiding camera popups).
3. **Hands-free Scanning**:
   - The application listens globally for high-speed scanner keystrokes (< 50ms) ending with `Enter`.
   - **No manual focusing of input fields is required**: simply aim the scanner at a vinyl sleeve barcode or QR code and pull the trigger from anywhere on the dashboard.
   - Normal manual keyboard typing in search fields is distinguished and unaffected.
4. **Live Diagnostics**:
   - Use the **Scanner Live-Test** area in Settings to verify scanned codes, format detection (1D Barcode vs 2D QR Code), and test the confirmation beep sound.
2. **Authorize Extension**:
   - Open your **Roon Remote** app (Desktop or Mobile).
   - Go to **Settings $\rightarrow$ Extensions** (*Einstellungen $\rightarrow$ Erweiterungen*).
   - Locate **Vinyl Tracker** and click **Enable** (*Aktivieren*).
3. **Select Playback Zone**:
   - Return to Vinyl Tracker Settings and click **Refresh Zones**.
   - Choose your default output zone (e.g., Living Room, HiFi system) from the dropdown and save.
4. **Play Records**:
   - Open any record in your **Collection** or **Dashboard** to view its details.
   - Click the purple **▶ Auf Roon abspielen** button in the header. Vinyl Tracker searches Roon and plays the full album from start to finish.
   - Alternatively, ask an AI assistant via the MCP server (`play_record_on_roon`).

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
*Note: Unit tests (Vitest) strictly enforce >=80% code coverage for statements, lines, branches, and functions (thresholds in `angular.json`). Run `npm test -- --watch=false --coverage` to check locally.*

**Available NPM Scripts:**
| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts the Angular development server on port 5173 with proxy configuration |
| `npm run build` | Builds the application for production |
| `npm run test` | Runs unit tests (Vitest + jsdom, no browser needed); add `-- --watch=false --coverage` for a single run with coverage enforcement |
| `npm run test:e2e` | Runs end-to-end tests (Playwright) with automatic dev server bootstrap |

Current high-risk regression coverage focuses on authentication, dashboard scanner access, and manual Discogs sync flows in Playwright plus backend negative-path tests for scan validation and ownership checks.

Architecture hardening: User endpoints use validated request DTOs, frontend error handling extracts typed unknown messages, and core features use modern Angular signals for reactive state management.

### Backend
Located in `/backend`.

**Run Unit & Integration Tests:**
```bash
cargo test --manifest-path backend/Cargo.toml
```

**Run Linter (Clippy):**
```bash
cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
```

**Run Backend Locally in Development Mode:**
```bash
cd backend
cargo run
```

### CI/CD
The project includes GitHub Actions workflows:
- **CI Pipeline** (`.github/workflows/ci.yml`):
  - Automatically builds, tests and checks the Backend (Rust 2024 / Cargo).
  - Builds and tests the Frontend (Node 24/Angular, Vitest unit tests with strict >=80% coverage thresholds from `angular.json`).
  - Runs Playwright end-to-end tests for all critical user workflows.
  - Builds and tests the MCP Server (Rust/Cargo, `rmcp`).
  - Enforces linting and tests across all components.
  - Runs on push and pull requests for `main` and `develop` (plus manual `workflow_dispatch`). Pushes to `main` additionally build and publish multi-arch Docker images (`linux/amd64`, `linux/arm64`) to GHCR.
  - **Self-Hosted Runners**: Jobs run on self-hosted Linux ARM64 runners (`[self-hosted, linux]`, Docker containers with mounted Docker socket for the PostgreSQL test container and Playwright), see [DEPLOYMENT.md](docs/DEPLOYMENT.md).
  - **Hybrid Multi-Platform Releases**: Release builds additionally use GitHub-hosted runners (`ubuntu-latest`, `macos-latest`) to produce native Linux and macOS MCP server binaries.
- **Auto Release** (`.github/workflows/release.yml`):
  - Automatically creates a GitHub Release (with tag `v<version>` from `frontend/package.json` and auto-generated release notes) when a Pull Request to `main` is successfully merged.
  - The Docker images for that release are published by the CI pipeline run of the merge push to `main`.
- **Supply-Chain Hardening**: All third-party actions are pinned to full commit SHAs (with the release tag as comment). Dependabot (`.github/dependabot.yml`) proposes weekly grouped updates against `develop`. Workflows from fork PRs of external contributors require manual maintainer approval before they run on the self-hosted runners.

## Model Context Protocol (MCP) Server

Vinyl Tracker provides a native Rust MCP Server located in `mcp/` to interact with your vinyl collection via LLMs and AI assistants:

```bash
# Build the binary
cd mcp
cargo build --release
```

Config snippet for Antigravity IDE / Claude Desktop (`mcp_config.json`):

```json
{
  "mcpServers": {
    "vinyl-tracker": {
      "command": "/path/to/vinyl-tracker/mcp/target/release/vinyl-mcp-server",
      "env": {
        "VINYL_API_URL": "http://localhost:8080",
        "VINYL_USERNAME": "your_user",
        "VINYL_PASSWORD": "your_password"
      }
    }
  }
}
```

Detailed guide, tool descriptions, and options: [mcp/README.md](mcp/README.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

