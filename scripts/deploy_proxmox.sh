#!/bin/bash
set -e

# ==============================================================================
# Vinyl Tracker - Proxmox / Docker Deployment & Release Update Script
# ==============================================================================
# Usage:
#   ./scripts/deploy_proxmox.sh [VERSION_TAG] [REGISTRY_PREFIX]
# Examples:
#   ./scripts/deploy_proxmox.sh                     # Deploy latest version from default GHCR
#   ./scripts/deploy_proxmox.sh v0.3.0              # Deploy specific version v0.3.0
#   ./scripts/deploy_proxmox.sh latest myuser/      # Custom registry prefix
# ==============================================================================

# Output Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERSION="${1:-latest}"
DEFAULT_REGISTRY="ghcr.io/gerontosepp/"
REGISTRY_PREFIX="${2:-$DEFAULT_REGISTRY}"

# Ensure trailing slash in REGISTRY_PREFIX if non-empty
if [ -n "$REGISTRY_PREFIX" ] && [[ "$REGISTRY_PREFIX" != */ ]]; then
    REGISTRY_PREFIX="${REGISTRY_PREFIX}/"
fi

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}        Vinyl Tracker - Deployment Script            ${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "Target Version : ${GREEN}${VERSION}${NC}"
echo -e "Registry Prefix: ${GREEN}${REGISTRY_PREFIX}${NC}"
echo ""

# ------------------------------------------------------------------------------
# 1. Prerequisites Check
# ------------------------------------------------------------------------------
echo -e "${BLUE}[1/5] Checking Prerequisites...${NC}"

if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}Error: Docker or Docker Compose is not installed on this machine.${NC}"
    echo "Please install Docker Desktop or Docker Engine + docker-compose plugin."
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose command detected: ${DOCKER_COMPOSE_CMD}${NC}"

# ------------------------------------------------------------------------------
# 2. Setup Environment (.env)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/5] Checking Environment Configuration (.env)...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
        cp .env.example .env
    else
        echo -e "${YELLOW}Creating default .env file...${NC}"
        cat << 'EOF' > .env
POSTGRES_DB=vinyl_tracker
POSTGRES_USER=vinyl_user
POSTGRES_PASSWORD=vinyl_password
VINYL_ENCRYPTION_PASSWORD=changeit-for-production-use-23948239048
VINYL_ENCRYPTION_SALT=5c074494c45680a7
JWT_SECRET=superSecretDevelopmentKeyDoNotUseInProduction123!
CORS_ALLOWED_ORIGINS=https://localhost:5173,https://127.0.0.1:5173
CORS_ALLOW_CREDENTIALS=false
IMAGE_PROXY_ALLOWED_HOSTS=i.discogs.com,s.discogs.com,api.discogs.com
AUTH_COOKIE_NAME=vinyl_token
AUTH_COOKIE_MAX_AGE_SECONDS=86400
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=Lax
EOF
    fi

    # Auto-generate secure production secrets if default values remain
    if command -v openssl &> /dev/null; then
        echo -e "${GREEN}Generating secure random production keys for JWT and encryption...${NC}"
        RAND_JWT=$(openssl rand -hex 32 | tr -d '\n')
        RAND_SALT=$(openssl rand -hex 8 | tr -d '\n')
        RAND_ENC=$(openssl rand -hex 24 | tr -d '\n')
        RAND_DB_PASS=$(openssl rand -hex 16 | tr -d '\n')

        sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${RAND_JWT}|" .env
        sed -i.bak "s|^VINYL_ENCRYPTION_SALT=.*|VINYL_ENCRYPTION_SALT=${RAND_SALT}|" .env
        sed -i.bak "s|^VINYL_ENCRYPTION_PASSWORD=.*|VINYL_ENCRYPTION_PASSWORD=${RAND_ENC}|" .env
        sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${RAND_DB_PASS}|" .env
        rm -f .env.bak
    fi
fi

# Ensure REGISTRY_PREFIX is set in .env if not present
if ! grep -q "^REGISTRY_PREFIX=" .env; then
    echo "REGISTRY_PREFIX=${REGISTRY_PREFIX}" >> .env
else
    sed -i.bak "s|^REGISTRY_PREFIX=.*|REGISTRY_PREFIX=${REGISTRY_PREFIX}|" .env
    rm -f .env.bak
fi

echo -e "${GREEN}✓ Environment file (.env) ready.${NC}"

if grep -q "^CORS_ALLOWED_ORIGINS=https://localhost:5173" .env; then
    echo -e "${YELLOW}Hinweis: Wenn Sie über eine Domain (z.B. https://vinyl.meinedomain.de) zugreifen, tragen Sie diese bitte in .env bei CORS_ALLOWED_ORIGINS ein.${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Determine Compose File
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/5] Selecting Docker Compose configuration...${NC}"

COMPOSE_FILE=""
if [ -f "docker/docker-compose.registry.yml" ]; then
    COMPOSE_FILE="docker/docker-compose.registry.yml"
elif [ -f "docker-compose.registry.yml" ]; then
    COMPOSE_FILE="docker-compose.registry.yml"
elif [ -f "docker/docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker/docker-compose.prod.yml"
elif [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
else
    echo -e "${RED}Error: No docker-compose file found in current directory or docker/ subfolder.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Using compose file: ${COMPOSE_FILE}${NC}"

# ------------------------------------------------------------------------------
# 4. Pull and Start Containers
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/5] Deploying Release (${VERSION})...${NC}"

# If using registry file, set the image tag env variable or update Compose
export REGISTRY_PREFIX="${REGISTRY_PREFIX}"
export IMAGE_TAG="${VERSION}"
export VERSION_TAG="${VERSION}"

echo "Pulling latest container images..."
$DOCKER_COMPOSE_CMD --env-file .env -f "$COMPOSE_FILE" pull || echo -e "${YELLOW}Warning: Pull skipped or using local images.${NC}"

echo "Stopping existing containers..."
$DOCKER_COMPOSE_CMD --env-file .env -f "$COMPOSE_FILE" down --remove-orphans || true

echo "Starting updated application stack..."
$DOCKER_COMPOSE_CMD --env-file .env -f "$COMPOSE_FILE" up -d

# ------------------------------------------------------------------------------
# 5. Health Check & Post-Deployment Info
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/5] Performing System Health Check...${NC}"

HEALTH_OK=false
for i in {1..30}; do
    if curl -s -f http://localhost:8080/actuator/health > /dev/null 2>&1 || curl -s http://localhost:8080/api/ > /dev/null 2>&1; then
        HEALTH_OK=true
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$HEALTH_OK" = true ]; then
    echo -e "${GREEN}✔ Health Check PASSED: Backend is responsive!${NC}"
else
    echo -e "${YELLOW}⚠ Health Check Pending: Backend is still starting up. Check status with: ${DOCKER_COMPOSE_CMD} -f ${COMPOSE_FILE} logs -f backend${NC}"
fi

echo -e "\n${BLUE}Cleaning up old unused Docker images...${NC}"
docker image prune -f > /dev/null 2>&1 || true

echo -e "\n${GREEN}=====================================================${NC}"
echo -e "${GREEN}      Deployment Completed Successfully!             ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "Frontend Port  : Port 80 (HTTP)"
echo -e "Backend Port   : Port 8080 (HTTP)"
echo -e "Database       : PostgreSQL 16 (Port 5432)"
echo ""
echo -e "${YELLOW}Proxmox / Reverse Proxy Reminder:${NC}"
echo "For camera barcode scanning, ensure HTTPS is terminated at your Reverse Proxy"
echo "(e.g., Nginx Proxy Manager / Traefik / Caddy) pointing to Port 80 of this host."
echo ""
