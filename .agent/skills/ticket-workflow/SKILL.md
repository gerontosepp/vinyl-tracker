---
name: ticket-workflow
description: >-
  Standardized end-to-end workflow to analyze, implement, test, document,
  review, merge, and close GitHub issues/tickets in Vinyl Tracker.
---

# Vinyl Tracker Ticket Workflow Skill

This skill defines the complete operational procedure for processing a GitHub issue or ticket from analysis through to user approval, merging, and closure.

---

## 1. Issue Analysis & Requirements

1. **Inspect Issue Details**:
   ```bash
   gh issue view <ISSUE_ID>
   ```
2. **Clarify Requirements & Acceptance Criteria**:
   - Identify affected components (`backend`, `frontend`, `db/migration`, `discogs`, `roon`, `mcp`).
   - If requirements or UX details are ambiguous, clarify with the user (e.g. via `ask_question`).

---

## 2. Branching & Workspace Preparation

1. **Sync Base Branch**:
   Always branch off the latest `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Create Feature Branch**:
   Naming conventions:
   - Features: `feat/<ISSUE_ID>-<short-description>` (e.g. `feat/70-last-played-at-column`)
   - Bugfixes: `fix/<ISSUE_ID>-<short-description>`
   - Refactorings / Chores: `chore/<ISSUE_ID>-<short-description>`

   ```bash
   git checkout -b feat/<ISSUE_ID>-<short-description>
   ```

---

## 3. Implementation Standards

Apply the mandatory project rules defined in `.agent/rules/`:
- **Coding Standards** ([`coding_standards.md`](../../rules/coding_standards.md)):
  - Layered architecture (Routes -> Services -> Models / SQLx queries).
  - Rust 2024 edition, Axum 0.8, Tokio 1.x & SQLx 0.8.
  - Strict UTC date/time handling (`chrono::DateTime<Utc>`).
  - Angular 19 standalone components with Signals and Tailwind CSS.
  - Multi-language support via `LanguageService` (maintain both `de` and `en` keys).
  - Structured error details via `ProblemDetail` (RFC 7807) and user-friendly toasts.
- **Database Changes**:
  - Follow the [`database-migrations`](../database-migrations/SKILL.md) skill for Refinery migrations.

---

## 4. Tests & Quality Gate

Before requesting user verification, all tests must pass locally:

1. **Backend Formatting, Tests & Linter**:
   ```bash
   cargo fmt --manifest-path backend/Cargo.toml -- --check
   cargo test --manifest-path backend/Cargo.toml
   cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
   ```
   - Add/update unit and integration tests for all modified logic.
   - Fix formatting issues with `cargo fmt --manifest-path backend/Cargo.toml` if needed.

2. **Frontend Tests & Build**:
   ```bash
   cd frontend
   npm test -- --watch=false
   npm run build
   cd ..
   ```
   - Ensure all Karma/Jasmine tests pass and zero TypeScript errors exist.

---

## 5. Live Documentation Sync

Update project documentation immediately alongside code changes (see [`documentation_standards.md`](../../rules/documentation_standards.md)):
- **`README.md`**: Update if features, configuration, endpoints, or UI behavior changed.
- **`docs/Release-Info.md`**: Add summary bullet points under `## Unreleased`.
- **`docs/arc42.md`**: Update if architecture, domain models, or database schemas changed.

---

## 6. Deployment & User Verification

1. **Rebuild & Start Docker Containers**:
   ```bash
   docker compose up -d --build backend frontend
   ```
2. **Invite User to Verify**:
   - Summarize the implemented changes and test results.
   - Provide the test URL (`https://localhost:5173`).
   - Request verification and approval to merge.
   - **CRITICAL**: Never merge or delete the feature branch without explicit user approval!

---

## 7. Commit, Merge & Cleanup

Once the user approves:

1. **Conventional Commit**:
   ```bash
   git add .
   git commit -m "feat(scope): <short description> (#<ISSUE_ID>)"
   ```

2. **Merge into `develop` with `--no-ff`**:
   ```bash
   git checkout develop
   git pull origin develop
   git merge feat/<ISSUE_ID>-<short-description> --no-ff -m "Merge branch 'feat/<ISSUE_ID>-<short-description>' into develop"
   ```

3. **Push to Remote**:
   ```bash
   git push origin develop
   ```

4. **Delete Local Feature Branch**:
   ```bash
   git branch -d feat/<ISSUE_ID>-<short-description>
   ```

---

## 8. Close GitHub Issue

Close the issue via GitHub CLI with a concise summary of the resolution and commit hash:

```bash
gh issue close <ISSUE_ID> --comment "Implemented and merged into develop: <summary>."
```
