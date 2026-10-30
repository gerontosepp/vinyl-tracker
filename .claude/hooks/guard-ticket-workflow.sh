#!/bin/bash
# PreToolUse hook: keeps changes on the ticket-workflow track (see .claude/skills/ticket-workflow).
#  - Edit/Write/MultiEdit: not on develop/main (they are protected, every change goes through a branch + PR)
#  - git commit: not on develop/main, and the branch must be named <type>/<issue>-<description>
#  - gh pr create: the body must reference an issue ("Closes #<n>") unless it is a release/archive PR
# Receives the tool call as JSON on stdin. Exit code 2 blocks the call and reports the message to Claude.
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")
project="${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
branch=$(git -C "$project" branch --show-current 2>/dev/null || true)

block() {
    echo "ticket-workflow: $1" >&2
    echo "See .claude/skills/ticket-workflow/SKILL.md (no issue yet? 'gh issue create' first)." >&2
    exit 2
}

# Branches that are created by the release and archive procedures
exempt_branch() {
    [[ "$1" =~ ^release/v[0-9] || "$1" =~ ^chore/archive- || "$1" =~ ^dependabot/ ]]
}

case "$tool" in
    Edit | MultiEdit | Write)
        file_path=$(jq -r '.tool_input.file_path // empty' <<<"$input")
        # Only files of the project; the scratchpad and other locations are free
        case "$file_path" in "$project"/*) ;; *) exit 0 ;; esac
        if [[ "$branch" == "develop" || "$branch" == "main" ]]; then
            block "'$branch' is protected. Create a branch first: git checkout -b feat|fix|chore/<issue>-<description>"
        fi
        ;;
    Bash)
        command=$(jq -r '.tool_input.command // empty' <<<"$input")
        # Match the commands only where a command starts, not in quoted text such as a commit message or heredoc
        start='(^|[;&|[:cntrl:]])[[:space:]]*'
        if [[ "$command" =~ ${start}git[[:space:]]+commit([[:space:]]|$) ]]; then
            # A branch created in the same command is not visible yet
            [[ "$command" =~ (checkout[[:space:]]+-b|switch[[:space:]]+-c) ]] && exit 0
            if [[ "$branch" == "develop" || "$branch" == "main" ]]; then
                block "no commits on '$branch'. Create a branch first: git checkout -b feat|fix|chore/<issue>-<description>"
            fi
            if ! exempt_branch "$branch" && ! [[ "$branch" =~ ^(feat|fix|chore|docs|test|refactor)/[0-9]+- ]]; then
                block "branch '$branch' does not match <type>/<issue>-<description> (e.g. feat/70-last-played-at-column)."
            fi
        fi
        if [[ "$command" =~ ${start}gh[[:space:]]+pr[[:space:]]+create ]]; then
            exempt_branch "$branch" && exit 0
            [[ "$command" =~ --base[[:space:]]+main ]] && exit 0
            # A body read from a file or an editor cannot be checked here; CI checks it
            [[ "$command" =~ (--body-file|-F[[:space:]]) ]] && exit 0
            if ! [[ "$command" =~ (Closes|Fixes|Resolves|Refs)[[:space:]]+\#[0-9]+ ]]; then
                block "the PR body needs an issue reference, e.g. 'Closes #<issue>', plus a Review section."
            fi
        fi
        ;;
esac
exit 0
