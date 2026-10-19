#!/usr/bin/env bash
# Wrapper script for OpenSpec CLI in Vinyl Tracker
set -euo pipefail

# Ensure compatible Node.js is on PATH if running locally via nvm
if [ -d "$HOME/.nvm/versions/node/v24.22.0/bin" ]; then
    export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
fi

exec npx --yes @fission-ai/openspec "$@"
