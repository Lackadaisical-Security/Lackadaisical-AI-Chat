#!/bin/bash

# Lackadaisical AI Chat - Production Startup Script
# By Lackadaisical Security 2025
# https://lackadaisical-security.com

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Banner
echo -e "${CYAN}"
echo " ██╗      █████╗  ██████╗██╗  ██╗ █████╗ ██████╗  █████╗ ██╗███████╗██╗ ██████╗ █████╗ ██╗     "
echo " ██║     ██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██║██╔════╝██║██╔════╝██╔══██╗██║     "
echo " ██║     ███████║██║     █████╔╝ ███████║██║  ██║███████║██║███████╗██║██║     ███████║██║     "
echo " ██║     ██╔══██║██║     ██╔═██╗ ██╔══██║██║  ██║██╔══██║██║╚════██║██║██║     ██╔══██║██║     "
echo " ███████╗██║  ██║╚██████╗██║  ██╗██║  ██║██████╔╝██║  ██║██║███████║██║╚██████╗██║  ██║███████╗"
echo " ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝"
echo -e "${NC}"
echo ""
echo -e "                             ${GREEN}AI CHAT - Your Personal Companion${NC}"
echo -e "                             ${BLUE}By Lackadaisical Security 2025${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "  💡 First time? Run ${BOLD}./setup-lackadaisical-ai.sh${NC} first to install dependencies and init the DB."
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js
echo -e "${BLUE}🔍 Checking system requirements...${NC}"
if ! command_exists node; then
    echo -e "${RED}❌ ERROR: Node.js is not installed!${NC}"
    echo "📥 Please install Node.js from: https://nodejs.org/"
    echo "   Recommended version: 18.x or higher"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Node.js version $NODE_VERSION detected. Recommended: 18.x or higher${NC}"
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"

# Check npm
if ! command_exists npm; then
    echo -e "${RED}❌ ERROR: npm is not available!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# Check Ollama
echo -e "${BLUE}🔍 Checking Ollama status...${NC}"
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is running and accessible${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Ollama is not running on localhost:11434${NC}"
    echo ""
    echo "   To start Ollama:"
    echo "   1. Open a terminal and run: ollama serve"
    echo "   2. Pull the model: ollama pull lackadaisical-assistant:latest"
    echo ""
    echo "   Or download Ollama from: https://ollama.ai/"
    echo ""
    read -p "Continue without Ollama? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}🛑 Startup cancelled. Please start Ollama first.${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⏭️  Continuing without Ollama (AI features will be limited)...${NC}"
fi

echo ""
echo -e "${BLUE}📦 Checking dependencies...${NC}"

# Install root dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📥 Installing root dependencies...${NC}"
    npm install
fi

# Install backend dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo -e "${BLUE}📥 Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}📥 Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi

# Initialize database if needed
if [ ! -f "database/chat.db" ]; then
    echo -e "${BLUE}🗃️  Initializing database...${NC}"
    npm run init:db
fi

echo -e "${GREEN}✅ Dependencies ready!${NC}"
echo ""

# Production mode check
MODE="${1:-dev}"
if [ "$MODE" == "production" ] || [ "$MODE" == "prod" ]; then
    echo -e "${BLUE}🏭 Building for production...${NC}"
    npm run build
    
    echo ""
    echo -e "${BLUE}🚀 Starting production server...${NC}"
    echo ""
    echo -e "   ${GREEN}📍 Server will be available at: http://localhost:3001${NC}"
    echo ""
    
    # Start production server
    cd backend && npm start
else
    echo -e "${BLUE}🔄 Starting development servers...${NC}"
    echo ""
    echo -e "   ${GREEN}📍 Frontend: http://localhost:3000${NC}"
    echo -e "   ${GREEN}📍 Backend API: http://localhost:3001${NC}"
    echo -e "   ${GREEN}📍 Ollama: http://localhost:11434${NC}"
    echo ""
    
    echo -e "${CYAN}🤖 Companion Commands Available:${NC}"
    echo "   /help     - View all commands"
    echo "   /checkin  - Daily emotional check-in"
    echo "   /journal  - Reflective journaling"
    echo "   /reflect  - Guided reflection"
    echo "   /memory   - View conversation history"
    echo "   /mood     - Track your mood"
    echo "   /gratitude- Share gratitude"
    echo "   /goals    - Set personal goals"
    echo ""
    
    # Start development servers
    npm run dev
fi
