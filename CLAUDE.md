# CLAUDE.md

Entry point for Claude Code. The project guide lives in `docs/CLAUDE.md` and is imported here so it is loaded at session start:

@docs/CLAUDE.md

## Workflow

- Project skills are available under `.claude/skills/` (symlinks to `.agent/skills/` and `.agents/skills/`). Use `ticket-workflow` for issues and `release-management` for releases.
- `develop` and `main` are protected: every change goes through a PR. Merge only after the user explicitly says so.
- At the end of every feature or fix, update the local Docker stack (`docker compose up --build -d backend` if the backend changed; check that the frontend dev server rebuilt) – see `ticket-workflow`, section 6.
- `docs/Release-Info.md` is the source for the in-app release notes; a hook in `.claude/settings.json` regenerates `frontend/src/app/core/constants/release-info.data.ts` and `frontend/public/assets/release-info.json` after each edit.
