#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")"

# Read current version from frontend/package.json
CURRENT_VERSION=$(grep -m1 '"version":' frontend/package.json | awk -F: '{ print $2 }' | sed 's/[ ",]//g')

echo "Current Version: $CURRENT_VERSION"
read -p "Enter new version: " NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo "Version cannot be empty"
    exit 1
fi

echo "Updating Frontend to $NEW_VERSION..."
# Update package.json version
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" frontend/package.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" frontend/package-lock.json 2>/dev/null || true

echo "Updating Backend to $NEW_VERSION..."
# Update pom.xml version
cd backend
mvn versions:set -DnewVersion=$NEW_VERSION -DgenerateBackupPoms=false
cd ..

echo "Committing changes..."
git add frontend/package.json frontend/package-lock.json backend/pom.xml
git commit -m "chore(release): bump version to $NEW_VERSION"

echo "Creating Git Tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "Done! Run 'git push && git push --tags' to publish."
