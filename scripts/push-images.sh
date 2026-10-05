#!/bin/bash
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Default registry prefix (change this or pass as argument)
REGISTRY_PREFIX=${1:-"myuser/"}

echo "Building and Pushing images with prefix: $REGISTRY_PREFIX"
echo "Example usage: ./push-images.sh mydockerhubuser/"
echo ""

# 1. Backend
echo "=== Backend ==="
echo "Building..."
docker build -t vinyl-tracker-backend:latest ./backend
echo "Tagging..."
docker tag vinyl-tracker-backend:latest "${REGISTRY_PREFIX}vinyl-tracker-backend:latest"
echo "Pushing..."
docker push "${REGISTRY_PREFIX}vinyl-tracker-backend:latest"

# 2. Frontend
echo ""
echo "=== Frontend ==="
echo "Building (Production target)..."
docker build --target production -t vinyl-tracker-frontend:latest ./frontend
echo "Tagging..."
docker tag vinyl-tracker-frontend:latest "${REGISTRY_PREFIX}vinyl-tracker-frontend:latest"
echo "Pushing..."
docker push "${REGISTRY_PREFIX}vinyl-tracker-frontend:latest"

echo ""
echo "Done! Images pushed to ${REGISTRY_PREFIX}vinyl-tracker-backend:latest and ${REGISTRY_PREFIX}vinyl-tracker-frontend:latest"
