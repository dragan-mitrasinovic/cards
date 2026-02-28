#!/usr/bin/env bash
set -euo pipefail

# ─── Cards — Production LAN Launcher ────────────────────────────────────────
# Builds the Angular frontend and Go backend, then starts the server.
# Anyone on your local network can connect via the printed URL.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist/Cards/browser"
SERVER_DIR="$SCRIPT_DIR/server"
PORT=8080

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}▸${NC} $1"; }
ok()    { echo -e "${GREEN}✔${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "${RED}✖${NC} $1"; exit 1; }

# ─── Early sudo prompt ───────────────────────────────────────────────────────
# Ask for the password up front so later sudo calls (e.g. firewall check) don't
# interrupt the build output.
if command -v ufw >/dev/null 2>&1; then
    sudo -v 2>/dev/null || true
fi

# ─── Prerequisites ───────────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v node >/dev/null 2>&1 || fail "Node.js is not installed"
command -v npm  >/dev/null 2>&1 || fail "npm is not installed"
command -v go   >/dev/null 2>&1 || fail "Go is not installed"

ok "node $(node --version), npm $(npm --version), go $(go version | awk '{print $3}')"

# ─── Check npm dependencies ─────────────────────────────────────────────────
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    fail "npm dependencies are missing. Run 'npm ci' in $SCRIPT_DIR first."
else
    ok "node_modules present"
fi

# ─── Build Angular ───────────────────────────────────────────────────────────
info "Building Angular app (production)..."
(cd "$SCRIPT_DIR" && npx ng build --configuration production)
ok "Angular build complete → $DIST_DIR"

# ─── Build Go server ────────────────────────────────────────────────────────
info "Building Go server..."
(cd "$SERVER_DIR" && go build -o server .)
ok "Go server built → $SERVER_DIR/server"

# ─── Detect LAN IP ──────────────────────────────────────────────────────────
LAN_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")

# ─── Print access info ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              🃏  Cards Game Server                ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}                                                  ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Local:   ${GREEN}http://localhost:${PORT}${NC}                  ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Network: ${GREEN}http://${LAN_IP}:${PORT}${NC}$(printf '%*s' $((19 - ${#LAN_IP})) '')${BOLD}║${NC}"
echo -e "${BOLD}║${NC}                                                  ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Share the Network URL with your partner!        ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  Press Ctrl+C to stop the server.                ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}                                                  ${BOLD}║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Firewall reminder ──────────────────────────────────────────────────────
if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 || echo "unknown")
    if echo "$UFW_STATUS" | grep -qi "active"; then
        if ! sudo ufw status 2>/dev/null | grep -q "$PORT"; then
            warn "UFW firewall is active. If others can't connect, run:"
            echo -e "     ${YELLOW}sudo ufw allow ${PORT}/tcp${NC}"
            echo ""
        fi
    fi
fi

# ─── Start server ───────────────────────────────────────────────────────────
exec "$SERVER_DIR/server" -static "$DIST_DIR"
