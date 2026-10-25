# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Backend- and frontend-specific guidance lives in `backend/CLAUDE.md` and `frontend/CLAUDE.md` (loaded when working in those directories).

## Project

Vinyl Tracker — a personal vinyl record tracking app. Users scan barcodes / QR codes, identify records via the Discogs API, log listening sessions, play on Roon, and view analytics. Docker Compose orchestrates a high-performance Rust backend (Axum / Tokio / SQLx), an Angular PWA frontend, and PostgreSQL.

## Run the full stack
```bash
docker compose up --build -d                                 # dev: hot-reload frontend, waits for postgres healthcheck
docker compose -f docker/docker-compose.prod.yml up --build -d # prod: optimized build, port 80
```
Dev URLs: frontend `https://localhost:5173`, backend `http://localhost:8080`.

First-time setup requires an `.env` (`cp .env.example .env`) and local SSL certs via `mkcert` in `certs/` (see README for details; HTTPS is required for webcam barcode scanning). `JWT_SECRET` must be ≥32 chars or the backend fails fast at startup.

## Conventions (from `.agent/rules/`)

- **Dates/times (critical)**: ISO 8601 everywhere. Backend + DB always UTC (`chrono::DateTime<Utc>` / `NaiveDateTime` in UTC). Frontend receives UTC, displays local time.
- **API errors**: structured `ProblemDetail` JSON from backend; graceful toast handling on frontend.
- **DB migrations**: never edit shipped files in `backend/migrations/` – checksums are verified.
- **Testing**: never change business logic or UI behavior without adding/updating tests; keep coverage >80% with real assertions (no hollow tests). All tests must pass — no skipped/commented-out failing tests. No new TS/ESLint errors; fix types rather than using `any`/`@ts-ignore`.
- **Docs sync**: update `README.md` when features/config/setup change; update `docs/arc42.md` for significant architecture or schema changes.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- **Rustdoc/JSDoc** only for complex utilities, public API endpoints, and shared interfaces — not obvious logic.
