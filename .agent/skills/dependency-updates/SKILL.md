---
name: dependency-updates
description: >-
  Standardized procedure to check, update, and validate frontend and backend dependencies
  for Vinyl Tracker while maintaining compatibility, stability, and code coverage.
---

# Vinyl Tracker Dependency Updates Skill

This skill defines the routine for discovering, upgrading, and testing dependencies in the Vinyl Tracker repository.

## 1. Backend Dependency Upgrades (Rust)

### Checking Available Updates
Run cargo outdated or cargo update check from the `backend/` directory:
```bash
cd backend
cargo outdated  # if cargo-outdated is installed, or:
cargo update --dry-run
cd ..
```

### Known Project Constraints & Compatibility Rules
1. **Rust Edition**:
   The project targets Rust 2024 edition (`edition = "2024"`).
2. **Axum & Tower**:
   Ensure compatibility between `axum` (0.8) and `tower-http` (0.6).
3. **Database Driver**:
   `sqlx` (0.8) is the only PostgreSQL driver; schema migrations run via `sqlx::migrate!` (feature `migrate`). Do not reintroduce `tokio-postgres`/`refinery`.
4. **Workspace**:
   `backend/` is a Cargo workspace including `crates/vinyl-api-types` (shared with the MCP server in `mcp/`, which has its own `Cargo.toml`/`Cargo.lock` – update and test it separately).

### Backend Validation
After updating [`backend/Cargo.toml`](../../../backend/Cargo.toml) or [`mcp/Cargo.toml`](../../../mcp/Cargo.toml):
```bash
cd backend
cargo test
cargo clippy --all-targets -- -D warnings
cd ../mcp
cargo test
cargo clippy --all-targets -- -D warnings
cd ..
```

## 2. Frontend Dependency Upgrades

### Checking Available Updates
Check outdated npm packages in `frontend/`:
```bash
cd frontend
npm outdated
cd ..
```

### Known Frontend Constraints & Guidelines
1. **Angular Major Version**:
   The project is built on Angular 22 (`@angular/*` ^22.x, `@angular/cli` ^22.x). Do not bump to the next major version without a planned framework migration.
2. **NPM 12 Remote Fetching**:
   When using npm 12+, remote tarball downloads may be restricted by default. Use `--allow-remote=all`:
   ```bash
   cd frontend
   npm update --allow-remote=all
   cd ..
   ```
3. **Security Audit & Transitive Vulnerabilities**:
   Do not add `--legacy-peer-deps`: peer dependency conflicts must be resolved, not hidden (Dockerfile and CI install without it).
   Run audit fix for non-breaking transitive vulnerability patches:
   ```bash
   cd frontend
   npm audit fix --allow-remote=all
   cd ..
   ```

### Frontend Validation
```bash
cd frontend
# Ensure application builds cleanly
npm run build
cd ..
```

## 3. Docker Integration Check

Always verify that Docker container images build cleanly after dependency upgrades:
```bash
docker compose build
```

## 4. Documentation & Commit

1. Record updated libraries in [`docs/Release-Info.md`](../../../docs/Release-Info.md).
2. Commit with Conventional Commits:
   ```bash
   git add backend/Cargo.toml backend/Cargo.lock mcp/Cargo.toml mcp/Cargo.lock frontend/package.json frontend/package-lock.json docs/Release-Info.md
   git commit -m "chore: update backend and frontend project dependencies"
   ```
