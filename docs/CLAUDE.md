# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vinyl Tracker — a personal vinyl record tracking app. Users scan barcodes / QR codes, identify records via the Discogs API, log listening sessions, play on Roon, and view analytics. Docker Compose orchestrates a high-performance Rust backend (Axum / Tokio / SQLx), an Angular PWA frontend, and PostgreSQL.

## Repository layout

- `backend/` — Rust (edition 2024), Axum 0.8, Tokio 1.x, SQLx 0.8 REST API (the active backend).
- `frontend/` — **Angular 19 PWA (the active frontend)** — this is what Docker Compose builds and deploys, dev and prod.
- `docker/` — production & registry Docker Compose configurations (`docker-compose.prod.yml`, `docker-compose.registry.yml`).
- `scripts/` — operational automation scripts (`deploy_proxmox.sh`, `push-images.sh`, `release.sh`, `update_docker.sh`).
- `docs/` — `DEPLOYMENT.md`, `arc42.md` (architecture), `Release-Info.md`, `CLAUDE.md`.
- `.agent/rules/` — coding/quality/documentation conventions.
- `certs/` — local mkcert SSL certs (HTTPS required for webcam barcode scanning).

## Common commands

### Run the full stack
```bash
docker compose up --build -d                                 # dev: hot-reload frontend, waits for postgres healthcheck
docker compose -f docker/docker-compose.prod.yml up --build -d # prod: optimized build, port 80
```
Dev URLs: frontend `https://localhost:5173`, backend `http://localhost:8080`.

First-time setup requires an `.env` (`cp .env.example .env`) and local SSL certs via `mkcert` (see README for details). `JWT_SECRET` must be ≥32 chars or the backend fails fast at startup.

### Backend (`cd backend`)
```bash
cargo test                   # unit + integration tests
cargo test --test <name>     # run a specific integration test file
cargo clippy -- -D warnings  # linter (strictly enforced in CI)
cargo build --release        # build optimized release binary
```

### Frontend (`cd frontend`, Angular)
```bash
npm run dev       # ng serve on port 5173 with API proxy
npm run build     # production build
npm test          # Karma/Jasmine unit tests, headless (>80% coverage expected)
npm run test:e2e  # Playwright — requires the stack running locally
```
Run a single Playwright test: `npx playwright test <file> -g "<title>"`.

## Backend architecture

Strict layered architecture:
- **routes/** — Axum routers and HTTP handlers only; validates request DTOs and delegates to services.
- **services/** — all business logic (Discogs sync/client, scanning, analytics, Roon MOO websocket client, QR code PDF generator).
- **models/** — DTOs, domain models, and SQL representations with Serde snake_case serialization.

Key cross-cutting pieces:
- **Auth**: stateless JWT via `jsonwebtoken`. `auth_middleware` extracts token from HttpOnly cookie `vinyl_token` or `Bearer` header. Passwords hashed with BCrypt.
- **Discogs integration**: async `reqwest` client with exponential backoff and rate limiting. Per-user Discogs tokens encrypted via AES-256-GCM.
- **Image proxy**: `/api/proxy/image` with host allowlist and 24h in-memory caching.
- **Errors**: `AppError` returns RFC 7807 `ProblemDetail` JSON.
- **DB schema**: `sqlx::migrate` migrations in `backend/migrations/` (`<n>_<name>.sql`, never edit shipped files – checksums are verified) executed on startup; legacy refinery/Flyway histories are imported once (ADR-0017).
- **Logging**: `tracing` + `tracing-subscriber` structured logs.

## Frontend architecture (Angular)

`frontend/src/app` organized as:
- **core/** — `services/` (API clients), `interceptors/` (auth/error), `guards/` (route auth), `types/`, `utils/`.
- **features/** — `auth`, `dashboard`, `collection`, `statistics`, `settings` (feature modules/routes).
- **shared/components/** — layout (sidebar, bottom-nav, top-menu-bar), toast, barcode-scanner, statistic-widget.

Uses Angular **signals** for reactive state, Tailwind CSS v4, `html5-qrcode` for scanning, and PWA/service-worker. API errors surface as toast notifications, never silent failures.

## Conventions (from `.agent/rules/`)

- **Dates/times (critical)**: ISO 8601 everywhere. Backend + DB always UTC (`LocalDateTime`). Frontend receives UTC, displays local time.
- **API errors**: structured `ProblemDetail` JSON from backend; graceful toast handling on frontend.
- **Testing**: never change business logic or UI behavior without adding/updating tests; keep coverage >80% with real assertions (no hollow tests). All tests must pass — no skipped/commented-out failing tests. No new TS/ESLint errors; fix types rather than using `any`/`@ts-ignore`.
- **Docs sync**: update `README.md` when features/config/setup change; update `docs/arc42.md` for significant architecture or schema changes.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- **JavaDoc/JSDoc** only for complex utilities, public API endpoints, and shared interfaces — not obvious logic.
