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
sedi "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" frontend/package-lock.json 2>/dev/null || true

# Update versions in Angular component files
sedi "s/appVersion = '$CURRENT_VERSION'/appVersion = '$NEW_VERSION'/" frontend/src/app/shared/components/layout/top-menu-bar/top-menu-bar.component.ts
sedi "s/v$CURRENT_VERSION/v$NEW_VERSION/g" frontend/src/app/features/auth/login/login.component.ts
sedi "s/v$CURRENT_VERSION/v$NEW_VERSION/g" frontend/src/app/features/auth/register/register.component.ts

echo "Updating Backend to $NEW_VERSION..."
# Update pom.xml version
cd backend
mvn versions:set -DnewVersion=$NEW_VERSION -DgenerateBackupPoms=false
cd ..

echo "Updating README.md to v$NEW_VERSION..."
# Update the first line of README.md to "# Vinyl Tracker v$NEW_VERSION"
sedi "1s/.*/# Vinyl Tracker v$NEW_VERSION/" README.md

echo "Committing changes..."
git add frontend/package.json frontend/package-lock.json backend/pom.xml README.md \
    frontend/src/app/shared/components/layout/top-menu-bar/top-menu-bar.component.ts \
    frontend/src/app/features/auth/login/login.component.ts \
    frontend/src/app/features/auth/register/register.component.ts
git commit -m "chore(release): bump version to $NEW_VERSION"

echo "Done! Run 'git push' to push the bump to develop."
echo "Then, merge to main and create a real GitHub Release to trigger the docker image build."
