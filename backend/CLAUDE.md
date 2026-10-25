# Backend (Rust)

## Commands
```bash
cargo test                                           # unit + integration tests (needs PostgreSQL from docker compose)
cargo clippy --all-targets -- -D warnings            # linter (strictly enforced in CI)
cargo llvm-cov --summary-only --fail-under-lines 80  # coverage gate enforced in CI
```

## Architecture

Strict layered architecture:
- **routes/** — Axum routers and HTTP handlers only; validates request DTOs and delegates to services.
- **services/** — all business logic (Discogs sync/client, scanning, analytics, Roon MOO websocket client, QR code PDF generator).
- **models/** — DTOs, domain models, and SQL representations with Serde snake_case serialization.

Key cross-cutting pieces:
- **Auth**: stateless JWT via `jsonwebtoken`. The `CurrentUser` extractor (`backend/src/auth/middleware.rs`) reads the token from the `Bearer` header or the HttpOnly cookie `vinyl_token`. Auth endpoints are rate-limited per client IP (`TRUSTED_PROXIES` controls forwarded headers). Passwords hashed with BCrypt.
- **Discogs integration**: async `reqwest` client with `governor` rate limiting (60 req/min) and `moka` caching (releases 24 h, prices 1 h); no automatic retries. Per-user Discogs tokens encrypted via AES-256-GCM.
- **Image proxy**: `/api/proxy/image` with host allowlist and 24h in-memory caching.
- **Errors**: `AppError` returns RFC 7807 `ProblemDetail` JSON.
- **DB schema**: `sqlx::migrate` migrations in `backend/migrations/` (`<n>_<name>.sql`, never edit shipped files – checksums are verified) executed on startup; legacy refinery/Flyway histories are imported once (ADR-0017).
- **Logging**: `tracing` + `tracing-subscriber` structured logs.
