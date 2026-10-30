# CLAUDE.md

Entry point for Claude Code. The project guide lives in `docs/CLAUDE.md` and is imported here so it is loaded at session start:

@docs/CLAUDE.md

## Workflow

- Project skills are available under `.claude/skills/` (symlinks to `.agent/skills/` and `.agents/skills/`). Use `release-management` for releases.
- **Every change goes through `ticket-workflow`** – anything in `backend/`, `frontend/src/`, `mcp/`, migrations, docs or specs, whether the request names a ticket or not ("Change: …", "Fix: …"). Load the skill before touching code. Without an issue number, create one first (`gh issue create`), then branch `feat|fix|chore/<issue>-<description>` from `develop`. The full path is: issue → branch → implementation → tests → docs and specs (`openspec/specs/` searched) → `code-review` skill → commit → PR with `Closes #<issue>` and a Review section → CI.
- Enforced by a hook (`.claude/hooks/guard-ticket-workflow.sh`: no edits or commits on `develop`/`main`, branch name pattern, `Closes #` in `gh pr create`) and by the CI job `Ticket workflow`. If the hook blocks you, fix the cause (branch, issue) instead of working around it.
- `develop` and `main` are protected: every change goes through a PR. Merge only after the user explicitly says so.
- At the end of every feature or fix, update the local Docker stack (`docker compose up --build -d backend` if the backend changed; check that the frontend dev server rebuilt) – see `ticket-workflow`, section 6.
- `docs/Release-Info.md` is the source for the in-app release notes; a hook in `.claude/settings.json` regenerates `frontend/src/app/core/constants/release-info.data.ts` and `frontend/public/assets/release-info.json` after each edit.
