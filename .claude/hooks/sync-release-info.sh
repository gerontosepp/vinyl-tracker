#!/bin/bash
# PostToolUse hook: regenerate the frontend release data whenever docs/Release-Info.md is edited.
# Receives the tool call as JSON on stdin; does nothing for other files.
set -euo pipefail

file_path=$(jq -r '.tool_input.file_path // empty')
case "$file_path" in
    */docs/Release-Info.md) ;;
    *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
if ! output=$(node scripts/sync-release-info.js 2>&1); then
    # Exit code 2 reports the failure back to Claude
    echo "sync-release-info.js failed: $output" >&2
    exit 2
fi
