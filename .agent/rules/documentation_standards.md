---
trigger: always_on
---

1. **Keep Docs Sync**: 
   - If you change features, configuration, or setup steps, you MUST update `README.md` immediately. Do not wait for a separate documentation task.
   - For new features, bugfixes, or notable library updates, add an entry under `## Unreleased` in `docs/Release-Info.md`.
2. **Self-Documenting Code**: 
   - Write clear, descriptive semantic variable and method names.
   - Avoid redundant comments for obvious logic (e.g., `// gets the user ID`).
   - Use JSDoc (Frontend) or Rustdoc (Backend) ONLY for complex utility functions, public API endpoints, and shared interfaces that require context.
3. **Architecture Updates**: Update the `arc42.md` file if you make significant architectural changes, add new system components, or change database schemas.
4. **Commit Messages**: Use Conventional Commits format with issue references for clarity (e.g., `feat(scope): description (#123)`, `fix(backend): description (#60)`).
