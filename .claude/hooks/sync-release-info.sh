#!/bin/bash
# PostToolUse hook: regenerate the frontend data whenever docs/Release-Info.md (release notes)
# or docs/Help.md / docs/Help.en.md (in-app help) is edited.
# Receives the tool call as JSON on stdin; does nothing for other files.
set -euo pipefail

file_path=$(jq -r '.tool_input.file_path // empty')
case "$file_path" in
    */docs/Release-Info.md) script=scripts/sync-release-info.js ;;
    */docs/Help.md | */docs/Help.en.md) script=scripts/sync-help.js ;;
    *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
if ! output=$(node "$script" 2>&1); then
    # Exit code 2 reports the failure back to Claude
    echo "$script failed: $output" >&2
    exit 2
fi
