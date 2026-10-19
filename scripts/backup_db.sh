#!/bin/bash
set -euo pipefail

# ==============================================================================
# Vinyl Tracker - PostgreSQL Backup & Restore Script
# ==============================================================================
# Usage:
#   ./scripts/backup_db.sh                       # Create a verified backup, prune old ones
#   ./scripts/backup_db.sh --restore <file>      # Restore a backup (asks for confirmation)
#   ./scripts/backup_db.sh --restore <file> -y   # Restore without confirmation prompt
#
# Configuration (environment variables):
#   VINYL_DB_CONTAINER       PostgreSQL container      (default: vinyl-postgres-prod)
#   VINYL_BACKEND_CONTAINER  Backend container         (default: vinyl-backend-prod)
#   BACKUP_DIR               Target directory          (default: ./backups)
#   BACKUP_RETENTION_DAYS    Delete older backups      (default: 14, 0 = keep all)
#
# Nightly backup via cron (example, 03:00):
#   0 3 * * * cd /opt/vinyl-tracker && ./scripts/backup_db.sh >> backups/backup.log 2>&1
# ==============================================================================

# Output Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DB_CONTAINER="${VINYL_DB_CONTAINER:-vinyl-postgres-prod}"
BACKEND_CONTAINER="${VINYL_BACKEND_CONTAINER:-vinyl-backend-prod}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# Tables that every valid Vinyl Tracker backup must contain
REQUIRED_TABLES=(app_user record_cache collection_item listen_event)

fail() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

require_running_container() {
    command -v docker &> /dev/null || fail "Docker is not installed on this machine."
    if [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" != "true" ]; then
        fail "Container '$1' is not running. Set VINYL_DB_CONTAINER to the PostgreSQL container name."
    fi
}

# Checks that a dump file is readable by pg_restore and contains all required tables.
verify_dump() {
    local file="$1"
    local listing
    [ -s "$file" ] || fail "Backup file '$file' is missing or empty."
    listing=$(docker exec -i "$DB_CONTAINER" pg_restore --list < "$file") \
        || fail "Backup file '$file' is not a valid pg_dump archive."
    for table in "${REQUIRED_TABLES[@]}"; do
        grep -qE "TABLE DATA public ${table} " <<< "$listing" \
            || fail "Backup file '$file' does not contain table '${table}'."
    done
}

backup() {
    echo -e "${BLUE}Vinyl Tracker - Database Backup${NC}"
    require_running_container "$DB_CONTAINER"
    mkdir -p "$BACKUP_DIR"

    local target tmp
    target="${BACKUP_DIR}/vinyl-$(date +%Y%m%d-%H%M%S).dump"
    tmp="${target}.partial"
    trap 'rm -f "$tmp"' EXIT

    echo "Container : ${DB_CONTAINER}"
    echo "Target    : ${target}"

    # Credentials are taken from the container's own environment (no password prompt).
    docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$tmp" \
        || fail "pg_dump failed."
    verify_dump "$tmp"
    mv "$tmp" "$target"
    trap - EXIT

    echo -e "${GREEN}✓ Backup created and verified ($(du -h "$target" | cut -f1)): ${target}${NC}"

    if [ "$RETENTION_DAYS" -gt 0 ]; then
        local deleted
        deleted=$(find "$BACKUP_DIR" -maxdepth 1 -name 'vinyl-*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')
        echo -e "${GREEN}✓ Retention: removed ${deleted} backup(s) older than ${RETENTION_DAYS} days.${NC}"
    fi
}

restore() {
    local file="$1"
    local assume_yes="$2"

    echo -e "${BLUE}Vinyl Tracker - Database Restore${NC}"
    require_running_container "$DB_CONTAINER"
    verify_dump "$file"

    echo -e "${YELLOW}This replaces ALL data in the database of '${DB_CONTAINER}' with '${file}'.${NC}"
    if [ "$assume_yes" != "yes" ]; then
        read -r -p "Type 'restore' to continue: " answer
        [ "$answer" = "restore" ] || fail "Restore aborted."
    fi

    local backend_stopped="no"
    if [ "$(docker inspect -f '{{.State.Running}}' "$BACKEND_CONTAINER" 2>/dev/null)" = "true" ]; then
        echo "Stopping backend container '${BACKEND_CONTAINER}' ..."
        docker stop "$BACKEND_CONTAINER" > /dev/null
        backend_stopped="yes"
    fi

    # --clean also drops _sqlx_migrations, so the restored migration history matches the backup.
    docker exec -i "$DB_CONTAINER" sh -c \
        'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --exit-on-error' < "$file" \
        || fail "pg_restore failed. The database may be partially restored – check the output above."

    echo -e "${GREEN}✓ Database restored from ${file}.${NC}"
    if [ "$backend_stopped" = "yes" ]; then
        echo "The backend is stopped. Start the matching application version, e.g.:"
        echo "  ./scripts/deploy_proxmox.sh <version>   or   docker start ${BACKEND_CONTAINER}"
    fi
}

case "${1:-}" in
    "")
        backup
        ;;
    --restore)
        [ -n "${2:-}" ] || fail "Usage: $0 --restore <file> [-y]"
        restore "$2" "$([ "${3:-}" = "-y" ] && echo yes || echo no)"
        ;;
    -h|--help)
        sed -n '7,20p' "$0" | sed 's/^# \{0,1\}//'
        ;;
    *)
        fail "Unknown option '$1'. Use --help for usage."
        ;;
esac
