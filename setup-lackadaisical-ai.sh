#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Lackadaisical AI Chat - Initial Setup Script
# Version: 2.0.0-rc1
# By Lackadaisical Security 2025-2026
# https://lackadaisical-security.com
#
# Run this ONCE before using start-lackadaisical-ai.sh.
# It installs all dependencies, creates required directories,
# sets up the environment config, and initializes the database.
# ═══════════════════════════════════════════════════════════════════════════

set -e

# ── Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Banner ────────────────────────────────────────────────────────────────
echo -e "${CYAN}"
echo " ██╗      █████╗  ██████╗██╗  ██╗ █████╗ ██████╗  █████╗ ██╗███████╗██╗ ██████╗ █████╗ ██╗     "
echo " ██║     ██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██║██╔════╝██║██╔════╝██╔══██╗██║     "
echo " ██║     ███████║██║     █████╔╝ ███████║██║  ██║███████║██║███████╗██║██║     ███████║██║     "
echo " ██║     ██╔══██║██║     ██╔═██╗ ██╔══██║██║  ██║██╔══██║██║╚════██║██║██║     ██╔══██║██║     "
echo " ███████╗██║  ██║╚██████╗██║  ██╗██║  ██║██████╔╝██║  ██║██║███████║██║╚██████╗██║  ██║███████╗"
echo " ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝"
echo -e "${NC}"
echo -e "                        ${BOLD}INITIAL SETUP — v2.0.0-rc1${NC}"
echo -e "                        ${BLUE}By Lackadaisical Security 2025-2026${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  This script performs a one-time setup to prepare the project for use."
echo "  Run this ONCE before using start-lackadaisical-ai.sh."
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════════════════════"
echo ""

# ── Navigate to project root ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ERRORS=0

# ── Helpers ───────────────────────────────────────────────────────────────
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

step_ok() {
    echo -e "  ${GREEN}✅ $1${NC}"
}

step_info() {
    echo -e "  ${BLUE}ℹ️  $1${NC}"
}

step_warn() {
    echo -e "  ${YELLOW}⚠️  $1${NC}"
}

step_fail() {
    echo -e "  ${RED}❌ $1${NC}"
}

# ══════════════════════════════════════════════════════════════════════════
# STEP 1: Prerequisites
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [1/8] Checking prerequisites...${NC}"
echo ""

# Node.js
if ! command_exists node; then
    step_fail "Node.js is NOT installed."
    echo "      📥 Download from: https://nodejs.org/ (v18+ required)"
    ERRORS=$((ERRORS + 1))
else
    NODE_VER=$(node --version)
    NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        step_warn "Node.js $NODE_VER detected. v18+ is required."
        ERRORS=$((ERRORS + 1))
    else
        step_ok "Node.js:  $NODE_VER"
    fi
fi

# npm
if ! command_exists npm; then
    step_fail "npm is NOT available."
    ERRORS=$((ERRORS + 1))
else
    step_ok "npm:      $(npm --version)"
fi

# Git (optional)
if command_exists git; then
    step_ok "Git:      $(git --version)"
else
    step_info "Git:      not found (optional)"
fi

# Project root
if [ ! -f "package.json" ]; then
    step_fail "package.json not found. Run this from the project root directory."
    ERRORS=$((ERRORS + 1))
fi

echo ""

if [ "$ERRORS" -gt 0 ]; then
    step_fail "$ERRORS prerequisite issue(s) found. Please resolve them and re-run this script."
    exit 1
fi

step_ok "All prerequisites met!"
echo ""

# ══════════════════════════════════════════════════════════════════════════
# STEP 2: Create required directories
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [2/8] Creating required directories...${NC}"
echo ""

for dir in database logs uploads; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "  📁 Created: $dir/"
    else
        step_ok "Exists:  $dir/"
    fi
done

echo ""

# ══════════════════════════════════════════════════════════════════════════
# STEP 3: Environment configuration
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [3/8] Setting up environment configuration...${NC}"
echo ""

if [ ! -f "backend/.env" ]; then
    if [ -f "env.example" ]; then
        echo "  📋 Creating backend/.env from env.example..."
        cp env.example backend/.env
        step_ok "Created: backend/.env"
        step_warn "IMPORTANT: Edit backend/.env to configure your settings."
        echo "      At minimum, change JWT_SECRET and SESSION_SECRET for production."
    else
        step_warn "env.example not found. backend/.env must be created manually."
    fi
else
    step_ok "Exists:  backend/.env"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════
# STEP 4: Install root dependencies
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [4/8] Installing root dependencies...${NC}"
echo ""

if [ -d "node_modules" ]; then
    step_ok "Root node_modules already present — skipping install"
    echo "      (delete node_modules/ and re-run to force reinstall)"
else
    echo "  📥 Running: npm install"
    npm install --loglevel=error
    step_ok "Root dependencies installed"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════
# STEP 5: Install backend dependencies
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [5/8] Installing backend dependencies...${NC}"
echo ""

if [ -d "backend/node_modules" ]; then
    step_ok "Backend node_modules already present — skipping install"
else
    echo "  📥 Running: cd backend && npm install"
    (cd backend && npm install --loglevel=error)
    step_ok "Backend dependencies installed"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════
# STEP 6: Install frontend dependencies
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [6/8] Installing frontend dependencies...${NC}"
echo ""

if [ -d "frontend/node_modules" ]; then
    step_ok "Frontend node_modules already present — skipping install"
else
    echo "  📥 Running: cd frontend && npm install"
    (cd frontend && npm install --loglevel=error)
    step_ok "Frontend dependencies installed"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════
# STEP 7: Initialize database
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [7/8] Initializing database...${NC}"
echo ""

if [ -f "database/chat.db" ]; then
    step_ok "Database already exists at database/chat.db"
    echo '      (use "npm run reset:db" to wipe and recreate)'
else
    echo "  📥 Running: npm run init:db"
    npm run init:db
    step_ok "Database initialized"
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════
# STEP 8: Check Ollama (optional)
# ══════════════════════════════════════════════════════════════════════════
echo -e "${BOLD} [8/8] Checking Ollama (optional)...${NC}"
echo ""

if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    step_ok "Ollama is running and accessible"
    echo '  💡 Tip: Pull a model with "ollama pull gemma3:4b" if you have not already'
elif command_exists ollama; then
    step_info "Ollama is installed but not currently running."
    echo "      Start it with: ollama serve"
else
    step_info "Ollama is not installed."
    echo "      📥 Download from: https://ollama.ai/"
    echo "      Ollama is required for local AI — external providers (OpenAI, etc.) work without it."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}${BOLD}✅  SETUP COMPLETE!${NC}"
echo ""
echo "  What to do next:"
echo ""
echo "    1. (Optional) Edit backend/.env to configure API keys and settings"
echo "    2. (Optional) Start Ollama: ollama serve"
echo '    3. (Optional) Pull a model: ollama pull gemma3:4b'
echo "    4. Launch the app: ./start-lackadaisical-ai.sh"
echo ""
echo "  Quick reference:"
echo "    ./start-lackadaisical-ai.sh          — Start all services"
echo "    npm test                              — Run all tests"
echo '    npm run reset:db                      — Wipe and recreate database'
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════════════════════"
echo ""
