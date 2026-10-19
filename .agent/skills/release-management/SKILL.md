---
name: release-management
description: >-
  Standardized end-to-end procedure to prepare, validate, bump versions across frontend
  and backend, update documentation, and cut releases for Vinyl Tracker.
---

# Vinyl Tracker Release Management Skill

This skill defines the exact workflow for releasing a new version of Vinyl Tracker.

## 1. Pre-Release Verification

Before bumping any versions, verify that the current branch is clean and all tests pass:

```bash
# 1. Backend formatting, tests & linter (Rust)
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml -- -D warnings

# 2. Frontend tests & production build
cd frontend && npm test -- --watch=false && npm run build && cd ..

# 3. Check git status
git status
```

## 2. Version Bump Checklist

Ensure that the target version follows Semantic Versioning (`MAJOR.MINOR.PATCH`, e.g., `0.6.0`).

The following files **must** be updated synchronously:

| Component / File | Field / Target Location |
| :--- | :--- |
| [`frontend/package.json`](../../../frontend/package.json) | `"version": "<NEW_VERSION>"` |
| [`frontend/package-lock.json`](../../../frontend/package-lock.json) | `"version": "<NEW_VERSION>"` (root & packages[""]) |
| [`release-info.data.ts`](../../../frontend/src/app/core/constants/release-info.data.ts) | `APP_VERSION` – generated from `package.json` by `scripts/sync-release-info.js`; never edit by hand. All frontend version badges (top menu bar, login, register, settings) read this constant. |
| [`backend/Cargo.toml`](../../../backend/Cargo.toml) | `version = "<NEW_VERSION>"` |
| [`README.md`](../../../README.md) | Header line 1 `# Vinyl Tracker v<NEW_VERSION>` and deploy examples |
| [`docs/Release-Info.md`](../../../docs/Release-Info.md) | New section `## v<NEW_VERSION> (YYYY-MM-DD)` with change summary |
| [`docs/DEPLOYMENT.md`](../../../docs/DEPLOYMENT.md) | Example version string update (if applicable) |
| [`scripts/deploy_proxmox.sh`](../../../scripts/deploy_proxmox.sh) | Example version string in header comment |

### Option A: Using the Automated Script (Recommended)
Execute [`release.sh`](../../../scripts/release.sh), which automatically bumps versions across `package.json`, all `Cargo.toml` manifests and `README.md`, and regenerates `APP_VERSION` for the frontend badges:
```bash
./scripts/release.sh
```
Follow the prompt to enter the new version.

### Option B: Manual Bump
```bash
# Update backend version
sed -i '' 's/^version = ".*"/version = "<NEW_VERSION>"/' backend/Cargo.toml
cargo check --manifest-path backend/Cargo.toml
```

## 3. Documentation Sync

Always add a new release entry at the top of [`docs/Release-Info.md`](../../../docs/Release-Info.md) directly below `## Unreleased`:

```markdown
## v<NEW_VERSION> (YYYY-MM-DD)
- Kurze Beschreibung der Kern-Änderungen
- Auflistung neuer Features, Fixes oder Dependency-Upgrades
```

## 4. Build & Container Verification

Re-verify the build artifacts after updating the versions:
```bash
# Verify backend compilation, formatting & tests
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml -- -D warnings

# Verify frontend build
cd frontend && npm run build && cd ..

# Verify Docker container build
docker compose build
```

## 5. Commit, Tag & Publish Workflow

1. **Commit Changes**:
   ```bash
   git add frontend/package.json frontend/package-lock.json backend/Cargo.toml backend/Cargo.lock README.md \
       frontend/src/app/core/constants/release-info.data.ts frontend/public/assets/release-info.json \
       docs/Release-Info.md docs/DEPLOYMENT.md deploy_proxmox.sh release.sh
   git commit -m "chore(release): bump version to <NEW_VERSION>"
   ```

2. **Push to `develop`**:
   ```bash
   git push origin develop
   ```

3. **Merge to `main` & Create GitHub Release**:
   - Merge `develop` into `main` (via PR or fast-forward).
   - Create a GitHub Release with tag `v<NEW_VERSION>` pointing to `main`.
   - The `.github/workflows/ci.yml` pipeline will automatically build and publish multi-platform Docker images to GHCR (`ghcr.io/gerontosepp/vinyl-tracker-backend:v<NEW_VERSION>` and `:latest`).
