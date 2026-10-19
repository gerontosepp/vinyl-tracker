---
name: pipeline-healer
description: >-
  Automated diagnostic, reproduction, and self-healing workflow for failed
  GitHub Actions CI pipeline runs in Vinyl Tracker.
---

# Vinyl Tracker Pipeline Healer Skill

This skill defines the standardized diagnostic, triage, and self-healing procedure whenever a GitHub Actions CI pipeline run fails on `main`, `develop`, or an active `feat/...` / `fix/...` branch.

---

## 1. Trigger Conditions

This workflow is invoked:
- **Automatically**: Via the background monitoring schedule or watchdog alert.
- **On Demand**: When the user asks to fix or inspect a CI run, or invokes `/ci-heal [RUN_ID]`.

---

## 2. Step-by-Step Healing Procedure

### Step 1: Identify the Failed Run & Branch
Find the most recent failed run:
```bash
gh run list --limit 5
```
Or inspect a specific run if provided:
```bash
gh run view <RUN_ID>
```
Extract:
- **`RUN_ID`**: Numeric ID of the failed execution.
- **`BRANCH`**: Target branch (e.g. `develop`, `feat/106-collection-mcp`).
- **`FAILED_JOB`**: Name of the job that broke (e.g. `backend-test`, `frontend-test`, `mcp-test`).

---

### Step 2: Fetch Failure Logs
Extract the exact failing step, compiler error, or test failure:
```bash
gh run view <RUN_ID> --log-failed
```
If logs are truncated or unclear:
```bash
./scripts/watch_pipeline.sh --heal <RUN_ID>
```

---

### Step 3: Switch & Sync Local Branch
Ensure you are on the exact branch that failed and up to date with remote:
```bash
git checkout <BRANCH>
git pull origin <BRANCH>
```

---

### Step 4: Classify & Fix by Failure Category

#### Category A: Rust Formatting (`cargo fmt --check`)
- **Symptom**: Step `Check Formatting` failed with diff.
- **Remedy**:
  ```bash
  cargo fmt --manifest-path backend/Cargo.toml
  # If MCP server failed:
  cargo fmt --manifest-path mcp/Cargo.toml
  ```

#### Category B: Rust Clippy Lints (`cargo clippy -- -D warnings`)
- **Symptom**: Step `Run Clippy Linter` failed on unused imports, dead code, or style warnings.
- **Remedy**:
  1. Inspect the specific warning lines reported in `--log-failed`.
  2. Fix manually or try:
     ```bash
     cargo clippy --manifest-path backend/Cargo.toml --fix --allow-dirty -- -D warnings
     ```
  3. Re-check: `cargo clippy --manifest-path backend/Cargo.toml -- -D warnings`.

#### Category C: Rust Unit & Integration Test Failures (`cargo test`)
- **Symptom**: Step `Run Backend Integration & Unit Tests` panicked or assertion failed.
- **Remedy**:
  1. Identify the failing test name and file from the log (e.g. `test_record_search`).
  2. Reproduce locally:
     ```bash
     cargo test --manifest-path backend/Cargo.toml -- <TEST_NAME>
     ```
  3. Analyze root cause (database query, mock response, serialization mismatch).
  4. Edit code or test fixture to fix the root cause.

#### Category D: Rust Test Coverage Gate (< 80%)
- **Symptom**: Step `Check Coverage Threshold` failed (coverage dropped below 80% line coverage per ADR-0006).
- **Remedy**:
  1. Identify which newly added/modified functions or endpoints in `backend/src/` lack unit tests.
  2. Add targeted unit or integration tests in `backend/tests/` or in the module's `#[cfg(test)] mod tests`.
  3. Verify with `cargo test --manifest-path backend/Cargo.toml`.

#### Category E: Frontend Vitest Unit Tests (`npm test`)
- **Symptom**: Step `Run Vitest Unit Tests` failed in `frontend-test` (failing test or coverage below the 80 % thresholds in `angular.json`).
- **Remedy**:
  1. Reproduce with compatible Node version:
     ```bash
     export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
     cd frontend && npm test -- --watch=false --coverage
     ```
  2. Inspect failed Vitest assertions (`AssertionError: expected ... to be ...`). Tests run in `jsdom`: browser APIs it lacks (e.g. `matchMedia`) must be stubbed with `vi.stubGlobal`.
  3. Fix the TypeScript component, signal, service, or test spec.

#### Category F: Frontend Build & TypeScript Compile (`npm run build`)
- **Symptom**: Step `Verify Frontend Production Build` failed with TS compile errors.
- **Remedy**:
  1. Run `cd frontend && npm run build`.
  2. Fix missing types, import paths, or template syntax errors. Never use `@ts-ignore` or `any`.

#### Category G: MCP Server Tests (`mcp-test`)
- **Symptom**: Tool registration test or schema check failed.
- **Remedy**:
  1. Reproduce: `cargo test --manifest-path mcp/Cargo.toml`.
  2. Update tool count in `mcp/tests/tools_test.rs` or fix schema definitions in `mcp/src/models.rs`.

---

### Step 5: Local Validation Gate
Before pushing the fix, all relevant quality gates MUST pass locally with **0 errors and 0 warnings**:
```bash
# Backend checks
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo test --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml -- -D warnings

# Frontend checks
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
cd frontend && npm test -- --watch=false && npm run build && cd ..
```

---

### Step 6: Commit, Push & Watch
1. **Commit using Conventional Commits**:
   ```bash
   git add .
   git commit -m "fix(ci): resolve <description> in CI run #<RUN_ID>"
   ```
2. **Push to Remote**:
   ```bash
   git push origin <BRANCH>
   ```
3. **Verify Pipeline Re-Run**:
   Observe the newly triggered pipeline execution:
   ```bash
   gh run list --limit 1
   ```
   Report the resolution, root cause, and new status to the user.
