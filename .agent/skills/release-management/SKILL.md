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
# 1. Backend tests
cd backend && mvn test && cd ..

# 2. Frontend production build
cd frontend && npm run build && cd ..

# 3. Check git status
git status
```

## 2. Version Bump Checklist

Ensure that the target version follows Semantic Versioning (`MAJOR.MINOR.PATCH`, e.g., `2.1.4`).

The following files **must** be updated synchronously:

| Component / File | Field / Target Location |
| :--- | :--- |
| [`frontend/package.json`](../../../frontend/package.json) | `"version": "<NEW_VERSION>"` |
| [`frontend/package-lock.json`](../../../frontend/package-lock.json) | `"version": "<NEW_VERSION>"` (root & packages[""]) |
| [`top-menu-bar.component.ts`](../../../frontend/src/app/shared/components/layout/top-menu-bar/top-menu-bar.component.ts) | `readonly appVersion = '<NEW_VERSION>';` |
| [`login.component.ts`](../../../frontend/src/app/features/auth/login/login.component.ts) | `v<NEW_VERSION>` badge |
| [`register.component.ts`](../../../frontend/src/app/features/auth/register/register.component.ts) | `v<NEW_VERSION>` badge |
| [`backend/pom.xml`](../../../backend/pom.xml) | `<version><NEW_VERSION></version>` |
| [`README.md`](../../../README.md) | Header line 1 `# Vinyl Tracker v<NEW_VERSION>` and deploy examples |
| [`docs/Release-Info.md`](../../../docs/Release-Info.md) | New section `## v<NEW_VERSION> (YYYY-MM-DD)` with change summary |
| [`docs/DEPLOYMENT.md`](../../../docs/DEPLOYMENT.md) | Example version string update (if applicable) |
| [`scripts/deploy_proxmox.sh`](../../../scripts/deploy_proxmox.sh) | Example version string in header comment |

### Option A: Using the Automated Script
Execute [`release.sh`](../../../scripts/release.sh):
```bash
./scripts/release.sh
```
Follow the prompt to enter the new version.

### Option B: Manual Backend Bump
```bash
cd backend
mvn versions:set -DnewVersion=<NEW_VERSION> -DgenerateBackupPoms=false
cd ..
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
# Verify backend packaging
cd backend && mvn package -DskipTests && cd ..

# Verify frontend build
cd frontend && npm run build && cd ..

# Verify Docker container build
docker compose build
```

## 5. Commit, Tag & Publish Workflow

1. **Commit Changes**:
   ```bash
   git add frontend/package.json frontend/package-lock.json backend/pom.xml README.md \
       frontend/src/app/shared/components/layout/top-menu-bar/top-menu-bar.component.ts \
       frontend/src/app/features/auth/login/login.component.ts \
       frontend/src/app/features/auth/register/register.component.ts \
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
