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

## 5. Branch, PR & Publish Workflow

`develop` and `main` are protected, so the release runs through two PRs. Publishing happens automatically when the second PR is merged.

1. **Release branch & version bump** (from the latest `develop`):
   ```bash
   git checkout develop && git pull --ff-only
   git checkout -b release/v<NEW_VERSION>
   # docs/Release-Info.md: insert "---" and "## v<NEW_VERSION> (YYYY-MM-DD)" directly below "## Unreleased"
   # scripts/deploy_proxmox.sh: update the example version in the header comment
   git add docs/Release-Info.md scripts/deploy_proxmox.sh
   echo "<NEW_VERSION>" | ./scripts/release.sh     # bumps all manifests, regenerates APP_VERSION, commits
   git push -u origin release/v<NEW_VERSION>
   gh pr create --base develop --title "chore(release): bump version to <NEW_VERSION>"
   ```
2. **Merge the bump** after green CI (`gh pr checks <PR> --watch`) and the user's go: `gh pr merge <PR> --merge --delete-branch`.
3. **Release PR `develop` → `main`**:
   ```bash
   gh pr create --base main --head develop --title "Release v<NEW_VERSION>"
   ```
   After green CI: `gh pr merge <PR> --merge` (never `--delete-branch` here – it would delete `develop`).
4. **Automatic publishing** – merging into `main` triggers:
   - `.github/workflows/release.yml` (**Auto Release**): creates the GitHub Release `v<NEW_VERSION>` (version from `frontend/package.json`, auto-generated notes) and attaches the MCP binaries (`linux-x86_64`, `macos-aarch64`).
   - `.github/workflows/ci.yml` on `main`: tests, then `publish-images` builds multi-arch images to GHCR (`:v<NEW_VERSION>` and `:latest`) and cleans up old packages.

   Do **not** run `gh release create` yourself – the workflow skips an existing release, so a manual one would end up without MCP binaries.
5. **Polish the release** once both workflows are green: set a descriptive title and prepend highlights and upgrade notes (migrations, config changes, breaking changes) to the generated notes:
   ```bash
   gh release edit v<NEW_VERSION> --title "v<NEW_VERSION> – <Kurztitel>" --notes-file <notes.md>
   ```
6. **Deploy** on the Proxmox host: `./scripts/deploy_proxmox.sh v<NEW_VERSION>` (creates a database backup before the update).
