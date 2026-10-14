#!/bin/bash
# ==============================================================================
# Vinyl Tracker - Dozzle SSH Tunnel & Minimal Browser Launcher
# ==============================================================================
# Usage:
#   ./scripts/open_dozzle.sh           # Establish tunnel & open Dozzle in minimal window
#   ./scripts/open_dozzle.sh --stop    # Stop active tunnel on port 8888
#   ./scripts/open_dozzle.sh --restart # Reconnect tunnel
# ==============================================================================

set -e

# Configuration
REMOTE_HOST="${DOZZLE_HOST:-2.31.34.79}"
REMOTE_USER="${DOZZLE_USER:-root}"
LOCAL_PORT="${DOZZLE_PORT:-8888}"
REMOTE_PORT="${DOZZLE_REMOTE_PORT:-8888}"
DOZZLE_URL="http://localhost:${LOCAL_PORT}/"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}       Dozzle Log Viewer - SSH Tunnel Launcher       ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Helper: Find PID using the port
get_port_pid() {
    lsof -ti :"$LOCAL_PORT" 2>/dev/null || true
}

# Flag handling: Stop
if [ "$1" = "--stop" ] || [ "$1" = "-s" ]; then
    PID=$(get_port_pid)
    if [ -n "$PID" ]; then
        echo -e "${YELLOW}Beende Prozess auf Port ${LOCAL_PORT} (PID: ${PID})...${NC}"
        kill $PID 2>/dev/null || true
        echo -e "${GREEN}Tunnel erfolgreich geschlossen.${NC}"
    else
        echo -e "${YELLOW}Kein aktiver Prozess auf Port ${LOCAL_PORT} gefunden.${NC}"
    fi
    exit 0
fi

# Flag handling: Restart
if [ "$1" = "--restart" ] || [ "$1" = "-r" ]; then
    PID=$(get_port_pid)
    if [ -n "$PID" ]; then
        echo -e "${YELLOW}Beende bestehenden Tunnel (PID: ${PID})...${NC}"
        kill $PID 2>/dev/null || true
        sleep 1
    fi
fi

# Helper: Open URL in a minimal browser window (app mode)
open_minimal_browser() {
    local url="$1"
    echo -e "${BLUE}Öffne minimales Browser-Fenster für ${GREEN}${url}${NC}..."
    
    # 1. Google Chrome (macOS App-Mode: separates Fenster ohne Adressleiste/Tabs)
    if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app="$url" >/dev/null 2>&1 &
        return 0
    fi
    
    # 2. Brave Browser (macOS)
    if [ -f "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" ]; then
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --app="$url" >/dev/null 2>&1 &
        return 0
    fi

    # 3. Microsoft Edge (macOS)
    if [ -f "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" ]; then
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --app="$url" >/dev/null 2>&1 &
        return 0
    fi

    # 4. Linux Chromium / Chrome
    if command -v google-chrome &>/dev/null; then
        google-chrome --app="$url" >/dev/null 2>&1 &
        return 0
    elif command -v chromium-browser &>/dev/null; then
        chromium-browser --app="$url" >/dev/null 2>&1 &
        return 0
    elif command -v chromium &>/dev/null; then
        chromium --app="$url" >/dev/null 2>&1 &
        return 0
    fi

    # 5. Fallback macOS / Linux
    if command -v open &>/dev/null; then
        open "$url"
    elif command -v xdg-open &>/dev/null; then
        xdg-open "$url" >/dev/null 2>&1 &
    else
        echo -e "${YELLOW}Bitte öffne die URL manuell im Browser: ${url}${NC}"
    fi
}

EXISTING_PID=$(get_port_pid)

if [ -n "$EXISTING_PID" ]; then
    echo -e "${YELLOW}Hinweis: Port ${LOCAL_PORT} ist bereits belegt (PID: ${EXISTING_PID}).${NC}"
    echo -e "${GREEN}Verwende bestehenden Tunnel.${NC}"
    open_minimal_browser "$DOZZLE_URL"
    echo -e "${GREEN}✓ Dozzle geöffnet!${NC}"
    echo -e "${YELLOW}Tipp: Führe '$0 --stop' aus, um den aktiven Tunnel zu beenden.${NC}"
    exit 0
fi

# SSH Tunnel starten
echo -e "Starte SSH-Tunnel zu ${GREEN}${REMOTE_USER}@${REMOTE_HOST}${NC} (Port ${LOCAL_PORT} -> ${REMOTE_PORT})..."
ssh -N -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}" "${REMOTE_USER}@${REMOTE_HOST}" &
SSH_PID=$!

cleanup() {
    if [ -n "$SSH_PID" ] && kill -0 "$SSH_PID" 2>/dev/null; then
        echo ""
        echo -e "${YELLOW}Schließe SSH-Tunnel (PID: ${SSH_PID})...${NC}"
        kill "$SSH_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# Warten bis Port verfügbar ist
echo -n "Warte auf Verbindung..."
READY=0
for i in {1..30}; do
    if ! kill -0 "$SSH_PID" 2>/dev/null; then
        echo -e "\n${RED}Fehler: SSH-Tunnel wurde unerwartet beendet (Authentifizierung oder Netzwerk prüfen).${NC}"
        exit 1
    fi
    if nc -z 127.0.0.1 "$LOCAL_PORT" 2>/dev/null; then
        READY=1
        break
    fi
    sleep 0.2
    echo -n "."
done

if [ "$READY" -eq 1 ]; then
    echo -e " ${GREEN}Verbunden!${NC}"
else
    echo -e " ${YELLOW}Timeout beim Port-Check, versuche Browser dennoch zu öffnen...${NC}"
fi

open_minimal_browser "$DOZZLE_URL"

echo ""
echo -e "${GREEN}✓ Dozzle ist erreichbar unter: ${DOZZLE_URL}${NC}"
echo -e "${YELLOW}Der SSH-Tunnel bleibt aktiv. Drücke [Ctrl+C] zum Beenden.${NC}"
echo ""

# Warten bis der Benutzer abbricht oder SSH terminiert
wait "$SSH_PID"
