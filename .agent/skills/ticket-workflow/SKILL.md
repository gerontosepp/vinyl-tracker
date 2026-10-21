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
3. **Spec-Driven Planning via OpenSpec**:
   - For non-trivial features, API additions, or architectural changes, initialize an OpenSpec change proposal:
     ```bash
     ./scripts/opsx.sh change new <ISSUE_ID>-<short-description>
     ```
     (or invoke `/opsx:propose "<short-description>"`).
   - Draft `proposal.md`, delta specifications under `specs/`, and the step-by-step checklist `tasks.md`.
   - Align the specification and acceptance criteria with the user before starting production implementation.

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
  - Angular 22 standalone components with Signals and Tailwind CSS.
  - Multi-language support via `LanguageService` (maintain both `de` and `en` keys).
  - Structured error details via `ProblemDetail` (RFC 7807) and user-friendly toasts.
- **Database Changes**:
  - Follow the [`database-migrations`](../database-migrations/SKILL.md) skill for `sqlx::migrate` migrations.

---

## 4. Tests & Quality Gate

Before requesting user verification, all tests must pass locally:

1. **Backend Formatting, Tests & Linter**:
   ```bash
   cargo fmt --manifest-path backend/Cargo.toml --all -- --check
   cargo test --manifest-path backend/Cargo.toml
   cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
   ```
   - Add/update unit and integration tests for all modified logic.
   - Fix formatting issues with `cargo fmt --manifest-path backend/Cargo.toml` if needed.

2. **Frontend Tests & Build**:
   ```bash
   cd frontend
   npm test -- --watch=false --coverage
   npm run build
   cd ..
   ```
   - Ensure all Vitest tests pass, coverage stays >= 80 % and zero TypeScript errors exist.

---

## 5. Live Documentation Sync

Update project documentation immediately alongside code changes (see [`documentation_standards.md`](../../rules/documentation_standards.md)):
- **`docs/adr/`**: If the ticket introduces an architectural decision, library/framework selection, security concept, or cross-cutting pattern, create an ADR (`docs/adr/XXXX-<titel>.md`), update `docs/adr/README.md`, and link it in `docs/arc42.md` Section 9.
- **`README.md`**: Update if features, configuration, endpoints, or UI behavior changed.
- **`docs/Release-Info.md`**: Add summary bullet points under `## Unreleased` (and run `node scripts/sync-release-info.js`).
- **`docs/arc42.md`**: Update if architecture, domain models, or database schemas changed.

---

## 6. Update the Local Stack

At the end of every feature or fix, bring the local Docker stack to the new state so the user can try it right away (browser, phone via `https://<LAN-IP>:5173`):

1. **Backend** (if `backend/` changed): rebuild and restart the container – it runs a built image, not the source:
   ```bash
   docker compose up --build -d backend
   ```
   Wait until it is `healthy` (`docker compose ps`); new migrations run on startup.
2. **Frontend**: the dev container mounts `./frontend` and serves the working tree, but the Angular dev server can crash on branch switches (`Failed to read index HTML file`) and then keeps serving a stale build. Check the log and restart if needed:
   ```bash
   docker compose logs --tail 5 frontend
   docker compose restart frontend   # if the last rebuild failed
   ```
   After `package.json` changes rebuild instead: `docker compose up --build -d frontend` (`node_modules` lives in the image).
3. **Verify**: `docker compose logs --since 2m frontend` shows `Application bundle generation complete`, the backend is `healthy`, and the change is visible at `https://localhost:5173`.
4. Tell the user which branch the stack is serving (the frontend shows the checked-out working tree).

---

## 7. Commit, Push & Pull Request

`develop` and `main` are protected – never push to them directly; every change goes through a PR against `develop`.

1. **Conventional Commit** (body explains the why, footer `Closes #<ISSUE_ID>`):
   ```bash
   git add <files>
   git commit -m "feat(scope): <short description> (#<ISSUE_ID>)"
   ```
2. **Push & open the PR**:
   ```bash
   git push -u origin feat/<ISSUE_ID>-<short-description>
   gh pr create --base develop --title "feat(scope): <short description> (#<ISSUE_ID>)" --body "Closes #<ISSUE_ID> ..."
   ```
   The PR body lists the changes and the local test results.
3. **Wait for CI** (backend, frontend, MCP jobs on the self-hosted runners, ~10 min):
   ```bash
   gh pr checks <PR> --watch
   ```
   Report the result to the user. Fix failures on the same branch (see the [`pipeline-healer`](../pipeline-healer/SKILL.md) skill).

---

## 8. Merge (only on explicit user instruction)

**CRITICAL**: Never merge without an explicit instruction from the user (e.g. "merge #123"). A green CI is not an approval.

1. **Merge & delete the branch**:
   ```bash
   gh pr merge <PR> --merge --delete-branch
   git checkout develop && git pull --ff-only
   ```
   The `Closes #<ISSUE_ID>` footer closes the issue automatically – verify with `gh issue view <ISSUE_ID>`.
2. **Archive the OpenSpec change (if any)** in a separate PR, because `develop` is protected:
   ```bash
   git checkout -b chore/archive-<ISSUE_ID>-<short-description>
   ./scripts/opsx.sh archive <ISSUE_ID>-<short-description>
   ```
   Commit as `docs(spec): archive OpenSpec change <ISSUE_ID>-<short-description> (#<ISSUE_ID>)`, then PR → CI → merge.

---

## 9. Parallel PRs & Release-Info Conflicts

Every PR adds its entry at the top of `## Unreleased` in `docs/Release-Info.md` and regenerates `release-info.data.ts` / `release-info.json`, so two open PRs always conflict there. After the first one is merged, rebase the other:

```bash
git checkout <branch> && git rebase develop
# docs/Release-Info.md: keep BOTH entries (newest first)
git checkout --theirs frontend/public/assets/release-info.json frontend/src/app/core/constants/release-info.data.ts
node scripts/sync-release-info.js        # regenerate from the merged Markdown
git add -A && GIT_EDITOR=true git rebase --continue
git push --force-with-lease
```

Re-run the frontend tests, wait for CI again and only then merge.
