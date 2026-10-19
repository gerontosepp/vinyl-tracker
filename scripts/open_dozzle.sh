#!/bin/bash
# ==============================================================================
# Vinyl Tracker - Dozzle SSH Tunnel & Minimal Browser Launcher
# ==============================================================================
# Usage:
#   ./scripts/open_dozzle.sh           # Establish tunnel & open Dozzle with auto-reconnect
#   ./scripts/open_dozzle.sh --stop    # Stop active tunnel on port 8888
#   ./scripts/open_dozzle.sh --restart # Reconnect tunnel
#   ./scripts/open_dozzle.sh --status  # Check current tunnel status
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
CYAN='\033[0;36m'
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
        sleep 0.5
        PID_RECHECK=$(get_port_pid)
        if [ -n "$PID_RECHECK" ]; then
            kill -9 $PID_RECHECK 2>/dev/null || true
        fi
        echo -e "${GREEN}Tunnel erfolgreich geschlossen.${NC}"
    else
        echo -e "${YELLOW}Kein aktiver Prozess auf Port ${LOCAL_PORT} gefunden.${NC}"
    fi
    exit 0
fi

# Flag handling: Status
if [ "$1" = "--status" ]; then
    PID=$(get_port_pid)
    if [ -n "$PID" ]; then
        if curl -s -m 2 "$DOZZLE_URL" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Tunnel ist aktiv und Dozzle antwortet auf ${DOZZLE_URL} (PID: ${PID})${NC}"
            exit 0
        else
            echo -e "${YELLOW}⚠ Port ${LOCAL_PORT} ist belegt (PID: ${PID}), aber Dozzle antwortet nicht.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ Kein Tunnel aktiv auf Port ${LOCAL_PORT}.${NC}"
        exit 1
    fi
fi

# Flag handling: Restart
if [ "$1" = "--restart" ] || [ "$1" = "-r" ]; then
    PID=$(get_port_pid)
    if [ -n "$PID" ]; then
        echo -e "${YELLOW}Beende bestehenden Tunnel (PID: ${PID})...${NC}"
        kill -9 $PID 2>/dev/null || true
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
    # Prüfen, ob der existierende Prozess tatsächlich antwortet
    if curl -s -m 2 "$DOZZLE_URL" >/dev/null 2>&1; then
        echo -e "${YELLOW}Hinweis: Port ${LOCAL_PORT} ist bereits belegt (PID: ${EXISTING_PID}) und antwortet.${NC}"
        echo -e "${GREEN}Verwende bestehenden Tunnel.${NC}"
        open_minimal_browser "$DOZZLE_URL"
        echo -e "${GREEN}✓ Dozzle geöffnet!${NC}"
        echo -e "${YELLOW}Tipp: Führe '$0 --stop' aus, um den aktiven Tunnel zu beenden.${NC}"
        exit 0
    else
        echo -e "${YELLOW}Port ${LOCAL_PORT} ist belegt (PID: ${EXISTING_PID}), reagiert aber nicht (unterbrochen/tot).${NC}"
        echo -e "${YELLOW}Bereinige alten Prozess und starte frischen Auto-Reconnect-Tunnel...${NC}"
        kill -9 "$EXISTING_PID" 2>/dev/null || true
        sleep 1
    fi
fi

# State management
RUNNING=1
SSH_PID=""

cleanup() {
    RUNNING=0
    echo ""
    if [ -n "$SSH_PID" ] && kill -0 "$SSH_PID" 2>/dev/null; then
        echo -e "${YELLOW}Schließe SSH-Tunnel (PID: ${SSH_PID})...${NC}"
        kill "$SSH_PID" 2>/dev/null || true
        sleep 0.2
    fi
    # Also clean up anything on the port
    CURR_PID=$(get_port_pid)
    if [ -n "$CURR_PID" ]; then
        kill -9 "$CURR_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}Dozzle-Tunnel beendet.${NC}"
    exit 0
}
trap cleanup EXIT INT TERM

start_ssh() {
    # Port freiräumen falls nötig
    CURR_PID=$(get_port_pid)
    if [ -n "$CURR_PID" ]; then
        kill -9 "$CURR_PID" 2>/dev/null || true
        sleep 0.5
    fi

    # SSH mit schnellem Keepalive und Erkennung von Verbindungsabbrüchen
    ssh -N \
        -o ServerAliveInterval=10 \
        -o ServerAliveCountMax=2 \
        -o ExitOnForwardFailure=yes \
        -o TCPKeepAlive=yes \
        -o ConnectTimeout=10 \
        -L "${LOCAL_PORT}:localhost:${REMOTE_PORT}" \
        "${REMOTE_USER}@${REMOTE_HOST}" &
    SSH_PID=$!
}

wait_for_port() {
    local max_attempts=40
    local attempt=0
    while [ "$attempt" -lt "$max_attempts" ]; do
        if ! kill -0 "$SSH_PID" 2>/dev/null; then
            return 1
        fi
        if nc -z 127.0.0.1 "$LOCAL_PORT" 2>/dev/null; then
            return 0
        fi
        sleep 0.25
        echo -n "."
        attempt=$((attempt + 1))
    done
    return 1
}

echo -e "Starte SSH-Tunnel zu ${GREEN}${REMOTE_USER}@${REMOTE_HOST}${NC} (Port ${LOCAL_PORT} -> ${REMOTE_PORT})..."
start_ssh

echo -n "Warte auf Verbindung..."
if wait_for_port; then
    echo -e " ${GREEN}Verbunden!${NC}"
else
    echo -e " ${RED}Fehler beim ersten Verbindungsaufbau.${NC}"
    echo -e "${YELLOW}Versuche trotzdem fortzufahren (Auto-Reconnect aktiv)...${NC}"
fi

open_minimal_browser "$DOZZLE_URL"

echo ""
echo -e "${GREEN}✓ Dozzle ist erreichbar unter: ${DOZZLE_URL}${NC}"
echo -e "${CYAN}⚡ Auto-Reconnect ist AKTIV (überwacht Verbindung alle 3s und stellt sie bei Abbruch automatisch wieder her).${NC}"
echo -e "${YELLOW}Drücke [Ctrl+C] zum Beenden.${NC}"
echo ""

# Supervisor / Auto-Reconnect Loop
PROBE_FAIL_COUNT=0

while [ "$RUNNING" -eq 1 ]; do
    RECONNECT_NEEDED=0

    # 1. Prüfen, ob der SSH-Prozess noch läuft
    if ! kill -0 "$SSH_PID" 2>/dev/null; then
        echo -e "${RED}[$(date +'%H:%M:%S')] ⚠ SSH-Verbindung wurde getrennt (Prozess beendet).${NC}"
        RECONNECT_NEEDED=1
    # 2. Prüfen, ob der Port noch geöffnet ist und Daten annimmt
    elif ! nc -z 127.0.0.1 "$LOCAL_PORT" 2>/dev/null; then
        PROBE_FAIL_COUNT=$((PROBE_FAIL_COUNT + 1))
        if [ "$PROBE_FAIL_COUNT" -ge 2 ]; then
            echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠ Port ${LOCAL_PORT} antwortet nicht mehr (Stale Socket).${NC}"
            RECONNECT_NEEDED=1
        fi
    else
        PROBE_FAIL_COUNT=0
    fi

    if [ "$RECONNECT_NEEDED" -eq 1 ]; then
        echo -e "${CYAN}[$(date +'%H:%M:%S')] 🔄 Baue SSH-Tunnel automatisch wieder auf...${NC}"
        
        # Kill stale SSH process if still lingering
        if [ -n "$SSH_PID" ] && kill -0 "$SSH_PID" 2>/dev/null; then
            kill -9 "$SSH_PID" 2>/dev/null || true
        fi
        
        start_ssh
        PROBE_FAIL_COUNT=0
        
        # Kurzes Warten auf Wiederherstellung
        if wait_for_port; then
            echo -e " ${GREEN}✓ Verbindung erfolgreich wiederhergestellt!${NC}"
        else
            echo -e " ${YELLOW}Wiederverbindungsversuch fehlgeschlagen. Nächster Versuch in 3s...${NC}"
        fi
    fi

    sleep 3
done
