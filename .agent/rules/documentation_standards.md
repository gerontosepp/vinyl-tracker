---
trigger: always_on
---

1. **Keep Docs Sync**: 
   - If you change features, configuration, or setup steps, you MUST update `README.md` immediately. Do not wait for a separate documentation task.
   - For new features, bugfixes, or notable library updates, add an entry under `## Unreleased` in `docs/Release-Info.md` (and keep `frontend/src/app/core/constants/release-info.data.ts` in sync via `node scripts/sync-release-info.js`).
   - When a user-visible feature, button or workflow changes, update the in-app help in `docs/Help.md` **and** `docs/Help.en.md` (same `{#anchor}`s) and regenerate it with `node scripts/sync-help.js`.
2. **Architecture Decision Records (ADRs)**:
   - For any fundamental architectural choice, technology or library selection, security concept, cross-cutting pattern, or non-trivial protocol/data-flow decision, create an ADR in `docs/adr/XXXX-<kebab-case-titel>.md` (sequential 4-digit numbering e.g. `0014`, following the template in `docs/adr/README.md`).
   - Always update the ADR index table in `docs/adr/README.md` and link the new ADR in `docs/arc42.md` Section 9 ("Architekturentscheidungen").
   - If a new decision modifies or supersedes a previous ADR, explicitly mark the previous ADR status as `Superseded by ADR-YYYY` and document the rationale.
3. **Spec-Driven Development (OpenSpec)**:
   - For non-trivial feature implementations or functional enhancements, use OpenSpec (`openspec/`) to plan and specify requirements before modifying production code:
     - Changes are drafted in `openspec/changes/<change-name>/` (`proposal.md`, delta `specs/`, `tasks.md`).
     - Domain source-of-truth specifications are maintained in `openspec/specs/<domain>/spec.md`.
     - After successful implementation, testing, and user verification, archive the change via `./scripts/opsx.sh archive <change-name>` to merge the deltas into the living domain specifications.
4. **Architecture & Concept Updates**: Update `docs/arc42.md` whenever significant architectural changes, new system components, modified domain models, or database schema alterations are introduced.
5. **Self-Documenting Code**: 
   - Write clear, descriptive semantic variable and method names.
   - Avoid redundant comments for obvious logic (e.g., `// gets the user ID`).
   - Use JSDoc (Frontend) or Rustdoc (Backend) ONLY for complex utility functions, public API endpoints, and shared interfaces that require context.
6. **Commit Messages**: Use Conventional Commits format with issue references for clarity (e.g., `feat(scope): description (#123)`, `fix(backend): description (#60)`, `docs(adr): add ADR-XXXX for ... (#123)`).
