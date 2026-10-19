#!/usr/bin/env bash
# ==============================================================================
# Vinyl Tracker CI Watchdog & Pipeline Healer
#
# Monitors GitHub Actions runs for Vinyl Tracker and provides instant failure
# analysis, failed log extraction, and automated local triage.
#
# Usage:
#   ./scripts/watch_pipeline.sh              # Check latest runs (status overview)
#   ./scripts/watch_pipeline.sh --watch      # Continuous monitoring loop (every 30s)
#   ./scripts/watch_pipeline.sh --heal [ID]  # Fetch failure logs and diagnose run
# ==============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

POLL_INTERVAL=30

check_dependencies() {
    if ! command -v gh &>/dev/null; then
        echo -e "${RED}Error: GitHub CLI ('gh') is not installed or not in PATH.${NC}" >&2
        exit 1
    fi
}

diagnose_run() {
    local run_id="$1"
    echo -e "${CYAN}=== Diagnosing Failed GitHub Actions Run #${run_id} ===${NC}"
    
    # Run details
    local info
    info=$(gh run view "$run_id" --json name,conclusion,status,headBranch,headSha,event,url,jobs 2>/dev/null || true)
    
    if [ -z "$info" ]; then
        echo -e "${RED}Failed to fetch details for run #${run_id}.${NC}" >&2
        return 1
    fi
    
    local branch
    branch=$(echo "$info" | grep -o '"headBranch":"[^"]*"' | head -n 1 | cut -d'"' -f4)
    local conclusion
    conclusion=$(echo "$info" | grep -o '"conclusion":"[^"]*"' | head -n 1 | cut -d'"' -f4)
    local url
    url=$(echo "$info" | grep -o '"url":"[^"]*"' | head -n 1 | cut -d'"' -f4)
    
    echo -e "Branch:     ${BOLD}${branch}${NC}"
    echo -e "Status:     ${RED}${conclusion}${NC}"
    echo -e "URL:        ${BLUE}${url}${NC}"
    echo ""
    echo -e "${YELLOW}--- Extracting Failed Job Logs ---${NC}"
    
    # Fetch failed logs via gh CLI
    if ! gh run view "$run_id" --log-failed 2>&1 | tail -n 80; then
        echo -e "${YELLOW}Could not fetch failed logs directly. Fetching full job summary:${NC}"
        gh run view "$run_id"
    fi
    
    echo ""
    echo -e "${GREEN}=== Recommended Next Action ===${NC}"
    echo -e "Switch to branch '${branch}' and ask Antigravity:"
    echo -e "  ${BOLD}git checkout ${branch} && git pull origin ${branch}${NC}"
    echo -e "  Prompt: ${BOLD}Behebe den Fehler in CI Run #${run_id} auf Branch ${branch}${NC}"
}

check_once() {
    echo -e "${BLUE}Checking recent GitHub Actions runs...${NC}"
    local runs
    runs=$(gh run list --limit 5)
    echo "$runs"
    echo ""
    
    # Check if latest run failed
    local failed_id
    failed_id=$(echo "$runs" | awk '$1 == "X" {print $7; exit}')
    local failed_branch
    failed_branch=$(echo "$runs" | awk '$1 == "X" {print $4; exit}')
    
    if [ -n "$failed_id" ]; then
        echo -e "${RED}ALERT: Found failed run #${failed_id} on branch '${failed_branch}'!${NC}"
        diagnose_run "$failed_id"
        return 1
    else
        echo -e "${GREEN}All recent pipeline runs completed successfully.${NC}"
        return 0
    fi
}

watch_loop() {
    echo -e "${CYAN}=== Starting Vinyl Tracker CI Pipeline Watcher ===${NC}"
    echo -e "Polling every ${POLL_INTERVAL}s. Press Ctrl+C to stop."
    echo ""
    
    local last_seen_failed=""
    
    while true; do
        local runs
        runs=$(gh run list --limit 3 2>/dev/null || true)
        
        if [ -n "$runs" ]; then
            local failed_id
            failed_id=$(echo "$runs" | awk '$1 == "X" {print $7; exit}')
            
            if [ -n "$failed_id" ] && [ "$failed_id" != "$last_seen_failed" ]; then
                last_seen_failed="$failed_id"
                echo ""
                echo -e "${RED}[$(date +'%H:%M:%S')] FAILURE DETECTED: Run #${failed_id}${NC}"
                diagnose_run "$failed_id"
                
                # macOS notification if available
                if command -v osascript &>/dev/null; then
                    osascript -e "display notification \"GitHub Actions Run #${failed_id} failed!\" with title \"Vinyl Tracker CI Alert\" sound name \"Basso\"" 2>/dev/null || true
                fi
            elif [ -z "$failed_id" ]; then
                local in_progress
                in_progress=$(echo "$runs" | awk '$1 == "*" {print $7; exit}')
                if [ -n "$in_progress" ]; then
                    echo -e "[$(date +'%H:%M:%S')] Pipeline run #${in_progress} is currently in progress..."
                else
                    echo -e "[$(date +'%H:%M:%S')] All recent pipeline runs are green (${GREEN}✓${NC})."
                fi
            fi
        fi
        
        sleep "$POLL_INTERVAL"
    done
}

# Main entrypoint
check_dependencies

case "${1:-}" in
    --heal)
        if [ -n "${2:-}" ]; then
            diagnose_run "$2"
        else
            failed_id=$(gh run list --limit 5 | awk '$1 == "X" {print $7; exit}')
            if [ -n "$failed_id" ]; then
                diagnose_run "$failed_id"
            else
                echo -e "${GREEN}No failed runs found in the last 5 pipeline executions.${NC}"
            fi
        fi
        ;;
    --watch)
        watch_loop
        ;;
    --help|-h)
        echo "Vinyl Tracker CI Watchdog & Pipeline Healer"
        echo ""
        echo "Usage:"
        echo "  ./scripts/watch_pipeline.sh              # Check status once"
        echo "  ./scripts/watch_pipeline.sh --watch      # Continuous monitoring loop"
        echo "  ./scripts/watch_pipeline.sh --heal [ID]  # Diagnose specific or latest failed run"
        ;;
    *)
        check_once
        ;;
esac
