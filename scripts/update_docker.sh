#!/bin/bash
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Define colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting update process for Vinyl Tracker...${NC}"

# Check for docker compose
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
elif docker-compose --version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "Error: docker compose is not installed."
    exit 1
fi

echo -e "${GREEN}1. Pulling latest code changes...${NC}"
git pull

echo -e "${GREEN}2. Stopping existing containers...${NC}"
$DOCKER_COMPOSE_CMD down

echo -e "${GREEN}3. Rebuilding and starting containers...${NC}"
$DOCKER_COMPOSE_CMD up -d --build

echo -e "${GREEN}4. Cleanup unused images (optional)...${NC}"
# docker image prune -f # Uncomment if desired

echo -e "${GREEN}Success! Application updated and running.${NC}"
echo "Backend running at: http://localhost:8080"
echo "Frontend running at: http://localhost:5173"
