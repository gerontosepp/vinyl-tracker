---
trigger: always_on
---

1. **Mandatory Testing**: Never modify business logic or UI behavior without adding or updating the corresponding tests.
2. **Testing Frameworks**: 
   - Backend: Use Rust built-in tests (`#[test]`, `#[tokio::test]`), unit tests in modules, and integration tests in `backend/tests/`.
   - Frontend: Use Vitest (Angular `@angular/build:unit-test` builder, `jsdom`) for unit tests, and Playwright for end-to-end tests.
3. **Coverage Goal**: Maintain comprehensive test coverage across services and routes. Enforce a minimum of **>= 80% line coverage** for Rust backend code (`cargo llvm-cov --fail-under-lines 80`). Do not write empty or hollow tests just to inflate coverage; assert actual business logic outcomes and UI state changes.
4. **Validation (Mandatory Commands)**: 
   - Backend: Always verify formatting, tests, coverage, and linter: `cargo fmt --manifest-path backend/Cargo.toml -- --check` (fix via `cargo fmt --manifest-path backend/Cargo.toml`), `cargo test --manifest-path backend/Cargo.toml`, `cargo llvm-cov --manifest-path backend/Cargo.toml --summary-only --fail-under-lines 80`, and `cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings`.
   - Frontend: Always run unit tests non-interactively: `cd frontend && npm test -- --watch=false && npm run build`.
   - ALL tests and checks must pass with 0 errors/warnings. Do not leave skipped or commented-out failing tests.
5. **Linting & Types**: Before completing a task, ensure no new TypeScript compiler or build errors were introduced. Fix any type mismatches rather than using `any` or `@ts-ignore`. Always ensure code is properly formatted via `cargo fmt`.
6. **Local Stack**: At the end of every feature or fix, update the local Docker stack so the change can be tried right away: `docker compose up --build -d backend` when the backend changed, and make sure the frontend dev server rebuilt without errors (`docker compose logs --tail 5 frontend`, otherwise `docker compose restart frontend`). See the `ticket-workflow` skill, section 6.
7. **Code Review**: Before opening a PR for code changes (backend, frontend, MCP, migrations), review the branch diff with the `code-review` skill plus `angular-developer` / `rust-best-practices` for the respective stack, fix confirmed findings and list deliberately open ones in the PR body. See the `ticket-workflow` skill, section 7.
