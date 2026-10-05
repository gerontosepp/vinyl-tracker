# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vinyl Tracker — a personal vinyl record tracking app. Users scan barcodes / QR codes, identify records via the Discogs API, log listening sessions, and view analytics. Docker Compose orchestrates a Spring Boot backend, an Angular PWA frontend, and PostgreSQL.

## Repository layout

- `backend/` — Spring Boot 4 / Java 25 REST API (the active backend).
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
Dev URLs: frontend `https://localhost:5173`, backend `http://localhost:8080`, Swagger UI `http://localhost:8080/swagger-ui.html`.

First-time setup requires an `.env` (`cp .env.example .env`) and local SSL certs via `mkcert` (see README for details). `JWT_SECRET` must be ≥32 chars or the backend fails fast at startup.

### Backend (`cd backend`)
```bash
mvn test        # unit tests only (Surefire)
mvn verify      # unit + integration tests (Failsafe) + JaCoCo >80% coverage enforcement
mvn -Psecurity-online verify   # + Sonatype OSS Index dependency scan (needs OSSINDEX_USERNAME/TOKEN; non-blocking)
```
Run a single test: `mvn test -Dtest=ScanServiceTest` or a method `mvn test -Dtest=ScanServiceTest#methodName`.

**Test naming matters — it selects the runner:** `*IntegrationTest.java` / `*IT.java` run under Failsafe (integration, needs `mvn verify`); everything else `*Test.java` runs under Surefire (`mvn test`). Integration tests use Testcontainers (real PostgreSQL) via `AbstractIntegrationTest`.

### Frontend (`cd frontend`, Angular)
```bash
npm run dev       # ng serve on port 5173 with API proxy
npm run build     # production build
npm test          # Karma/Jasmine unit tests, headless (>80% coverage expected)
npm run test:e2e  # Playwright — requires the stack running locally
```
Run a single Playwright test: `npx playwright test <file> -g "<title>"`.

## Backend architecture

Strict layered architecture under `com.antigravity.vinyltracker` — **do not skip layers**:
- **controller/** — HTTP routing + validated request DTOs only; delegates to services. No business logic.
- **service/** — all business logic.
- **repository/** — Spring Data JPA data access only.
- **model/** — JPA entities; `model/dto/` request/response DTOs; `model/discogs/` Discogs API mapping.

Key cross-cutting pieces:
- **Auth** (`security/`): stateless JWT. `JwtAuthenticationFilter` reads the token from an HttpOnly cookie (`AuthCookieService`, cookie name `vinyl_token`) **or** a Bearer header (fallback). `SecurityConfig` defines the public endpoints (login/register/reset-password/logout, `/api/proxy/**`, actuator health/info, swagger). Passwords are BCrypt.
- **Discogs integration** (`service/DiscogsApiClient`): wrapped with Resilience4j rate limiting (60 req/min) + retry with exponential backoff, and Caffeine caching (`CacheConfig`, 24h TTL). Per-user Discogs tokens are encrypted at rest via `TokenEncryptionService` (keyed by `VINYL_ENCRYPTION_PASSWORD`/`_SALT`).
- **Image proxy** (`controller/ImageProxyController` + `ImageProxyUrlValidator`): `/api/proxy/image` only fetches from the `image-proxy.allowed-hosts` allowlist (SSRF guard).
- **Errors**: `GlobalExceptionHandler` returns RFC 7807 `ProblemDetail` JSON for all validation/runtime failures.
- **DB schema**: Flyway migrations in `backend/src/main/resources/db/migration/` (`V#__*.sql`). JPA runs with `ddl-auto=validate` — **schema changes must be a new Flyway migration**, never entity-driven DDL. Prod uses `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` for first deploy against an existing DB.
- **Logging**: `RequestLoggingInterceptor` tracks request latency/errors.

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
