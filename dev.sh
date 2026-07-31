#!/bin/bash
# ============================================
# Aureka - One-click Dev Server Launcher
# ============================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ___  _  _ ___ _  _ _  _____ "
echo " / _ \| || | __| || | |/ / __|"
echo "| (_) | __ | _|| __ |   < _|"
echo " \___/|_||_|___|_||_|_|\_\___|"
echo -e "${NC}"
echo -e "  ${GREEN}Intelligent Data Analysis Platform${NC}"
echo ""

# Check node
if ! command -v node &> /dev/null; then
  echo -e "${RED}[ERROR] Node.js is not installed${NC}"
  exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}[ERROR] pnpm is not installed. Run: npm i -g pnpm${NC}"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}[INFO] Installing dependencies...${NC}"
  pnpm install --ignore-scripts
  echo ""
fi

# Check .env
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  echo -e "${YELLOW}[INFO] Creating .env from .env.example${NC}"
  cp .env.example .env
fi

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}[INFO] Shutting down servers...${NC}"
  kill $SERVER_PID 2>/dev/null
  kill $WEB_PID 2>/dev/null
  wait $SERVER_PID 2>/dev/null
  wait $WEB_PID 2>/dev/null
  echo -e "${GREEN}[DONE] All servers stopped${NC}"
}
trap cleanup EXIT INT TERM

# Start backend
echo -e "${GREEN}[START] Backend server (NestJS) -> http://localhost:3000${NC}"
cd "$ROOT_DIR/apps/server"
pnpm dev &
SERVER_PID=$!
cd "$ROOT_DIR"

# Wait a moment for backend to initialize
sleep 2

# Start frontend
echo -e "${GREEN}[START] Frontend server (Vite)  -> http://localhost:5173${NC}"
cd "$ROOT_DIR/apps/web"
pnpm dev &
WEB_PID=$!
cd "$ROOT_DIR"

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "  Frontend:  ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend:   ${GREEN}http://localhost:3000${NC}"
echo -e "  API Docs:  ${GREEN}http://localhost:3000/api${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "  Press ${RED}Ctrl+C${NC} to stop all servers"
echo ""

# Wait for both
wait
