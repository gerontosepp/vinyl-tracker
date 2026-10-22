#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Read current version from frontend/package.json
CURRENT_VERSION=$(grep -m1 '"version":' frontend/package.json | awk -F: '{ print $2 }' | sed 's/[ ",]//g')

echo "Current Version: $CURRENT_VERSION"
read -p "Enter new version: " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo "Version cannot be empty"
    exit 1
fi

# Portable sed in-place replacement for both macOS (BSD) and Linux (GNU)
sedi() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

echo "Updating Frontend to $NEW_VERSION..."
# Update package.json version
sedi "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" frontend/package.json
# Only the project's own entries (root and packages[""]): a blind replace would also hit
# dependencies that happen to share the version number
node -e '
const fs = require("fs");
const file = "frontend/package-lock.json";
const lock = JSON.parse(fs.readFileSync(file, "utf8"));
lock.version = process.argv[1];
lock.packages[""].version = process.argv[1];
fs.writeFileSync(file, JSON.stringify(lock, null, 2) + "\n");
' "$NEW_VERSION"

echo "Updating Backend, shared API types and MCP server to $NEW_VERSION..."
# Update Cargo.toml versions (backend workspace incl. vinyl-api-types, MCP server)
for manifest in backend/Cargo.toml backend/crates/vinyl-api-types/Cargo.toml mcp/Cargo.toml; do
    sedi "s/^version = \".*\"/version = \"$NEW_VERSION\"/" "$manifest"
done
(cd backend && cargo check >/dev/null 2>&1 || true)
(cd mcp && cargo check >/dev/null 2>&1 || true)

echo "Updating README.md to v$NEW_VERSION..."
# Update the first line of README.md to "# Vinyl Tracker v$NEW_VERSION"
sedi "1s/.*/# Vinyl Tracker v$NEW_VERSION/" README.md

echo "Syncing release info and APP_VERSION for the frontend version badges..."
node scripts/sync-release-info.js

echo "Committing changes..."
git add frontend/package.json frontend/package-lock.json backend/Cargo.toml backend/Cargo.lock README.md \
    backend/crates/vinyl-api-types/Cargo.toml mcp/Cargo.toml mcp/Cargo.lock \
    frontend/src/app/core/constants/release-info.data.ts \
    frontend/public/assets/release-info.json
git commit -m "chore(release): bump version to $NEW_VERSION"

echo "Done! Run 'git push' to push the bump to develop."
echo "Then, merge to main and create a real GitHub Release to trigger the docker image build."
