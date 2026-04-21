@echo off
title Lackadaisical AI Chat - Initial Setup
color 0E
setlocal EnableDelayedExpansion

echo.
echo  ██╗      █████╗  ██████╗██╗  ██╗ █████╗ ██████╗  █████╗ ██╗███████╗██╗ ██████╗ █████╗ ██╗     
echo  ██║     ██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██║██╔════╝██║██╔════╝██╔══██╗██║     
echo  ██║     ███████║██║     █████╔╝ ███████║██║  ██║███████║██║███████╗██║██║     ███████║██║     
echo  ██║     ██╔══██║██║     ██╔═██╗ ██╔══██║██║  ██║██╔══██║██║╚════██║██║██║     ██╔══██║██║     
echo  ███████╗██║  ██║╚██████╗██║  ██╗██║  ██║██████╔╝██║  ██║██║███████║██║╚██████╗██║  ██║███████╗
echo  ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝
echo.
echo                         INITIAL SETUP - v2.0.0-rc1
echo                         By Lackadaisical Security 2025-2026
echo                         https://lackadaisical-security.com
echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.
echo   This script performs a one-time setup to prepare the project for use.
echo   Run this ONCE before using start-lackadaisical-ai.bat.
echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "ERRORS=0"

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 1: Verify prerequisites
:: ────────────────────────────────────────────────────────────────────────────
echo  [1/8] Checking prerequisites...
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ Node.js is NOT installed.
    echo      📥 Download from: https://nodejs.org/ ^(v18+ required^)
    set /a ERRORS+=1
    goto :prereq_done
)
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo   ✅ Node.js:  %NODE_VER%

:: Validate Node.js major version >= 18
for /f "tokens=1 delims=." %%m in ("%NODE_VER:~1%") do set "NODE_MAJOR=%%m"
if %NODE_MAJOR% LSS 18 (
    echo   ⚠️  WARNING: Node.js %NODE_VER% detected. v18+ is required.
    set /a ERRORS+=1
)

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ npm is NOT available.
    set /a ERRORS+=1
    goto :prereq_done
)
for /f "tokens=*" %%v in ('npm --version') do set "NPM_VER=%%v"
echo   ✅ npm:      %NPM_VER%

:: Check Git (optional but helpful)
git --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('git --version') do set "GIT_VER=%%v"
    echo   ✅ Git:      %GIT_VER%
) else (
    echo   ℹ️  Git:      not found ^(optional^)
)

:: Check project root
if not exist "package.json" (
    echo   ❌ package.json not found. Please run this from the project root directory.
    set /a ERRORS+=1
)

:prereq_done
echo.
if %ERRORS% GTR 0 (
    echo   ❌ %ERRORS% prerequisite issue^(s^) found. Please resolve them and re-run this script.
    pause
    exit /b 1
)
echo   ✅ All prerequisites met!
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 2: Create required directories
:: ────────────────────────────────────────────────────────────────────────────
echo  [2/8] Creating required directories...
echo.

if not exist "database" (
    mkdir database
    echo   📁 Created: database\
) else (
    echo   ✅ Exists:  database\
)

if not exist "logs" (
    mkdir logs
    echo   📁 Created: logs\
) else (
    echo   ✅ Exists:  logs\
)

if not exist "uploads" (
    mkdir uploads
    echo   📁 Created: uploads\
) else (
    echo   ✅ Exists:  uploads\
)

echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 3: Set up environment configuration
:: ────────────────────────────────────────────────────────────────────────────
echo  [3/8] Setting up environment configuration...
echo.

if not exist "backend\.env" (
    if exist "env.example" (
        echo   📋 Creating backend\.env from env.example...
        copy /Y "env.example" "backend\.env" >nul
        echo   ✅ Created: backend\.env
        echo   ⚠️  IMPORTANT: Edit backend\.env to configure your settings.
        echo      At minimum, change JWT_SECRET and SESSION_SECRET for production.
    ) else (
        echo   ⚠️  env.example not found. backend\.env must be created manually.
    )
) else (
    echo   ✅ Exists:  backend\.env
)

echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 4: Install root dependencies
:: ────────────────────────────────────────────────────────────────────────────
echo  [4/8] Installing root dependencies...
echo.

if exist "node_modules" (
    echo   ✅ Root node_modules already present — skipping install
    echo      ^(delete node_modules\ and re-run to force reinstall^)
) else (
    echo   📥 Running: npm install
    call npm install --loglevel=error
    if %errorlevel% neq 0 (
        echo   ❌ Root dependency install failed!
        pause
        exit /b 1
    )
    echo   ✅ Root dependencies installed
)
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 5: Install backend dependencies
:: ────────────────────────────────────────────────────────────────────────────
echo  [5/8] Installing backend dependencies...
echo.

if exist "backend\node_modules" (
    echo   ✅ Backend node_modules already present — skipping install
) else (
    echo   📥 Running: cd backend ^&^& npm install
    cd backend
    call npm install --loglevel=error
    if %errorlevel% neq 0 (
        echo   ❌ Backend dependency install failed!
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo   ✅ Backend dependencies installed
)
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 6: Install frontend dependencies
:: ────────────────────────────────────────────────────────────────────────────
echo  [6/8] Installing frontend dependencies...
echo.

if exist "frontend\node_modules" (
    echo   ✅ Frontend node_modules already present — skipping install
) else (
    echo   📥 Running: cd frontend ^&^& npm install
    cd frontend
    call npm install --loglevel=error
    if %errorlevel% neq 0 (
        echo   ❌ Frontend dependency install failed!
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo   ✅ Frontend dependencies installed
)
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 7: Initialize database
:: ────────────────────────────────────────────────────────────────────────────
echo  [7/8] Initializing database...
echo.

if exist "database\chat.db" (
    echo   ✅ Database already exists at database\chat.db
    echo      ^(use "npm run reset:db" to wipe and recreate^)
) else (
    echo   📥 Running: npm run init:db
    call npm run init:db
    if %errorlevel% neq 0 (
        echo   ❌ Database initialization failed!
        pause
        exit /b 1
    )
    echo   ✅ Database initialized
)
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 8: Verify Ollama (optional)
:: ────────────────────────────────────────────────────────────────────────────
echo  [8/8] Checking Ollama ^(optional^)...
echo.

curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Ollama is running and accessible
    echo   💡 Tip: Pull a model with "ollama pull gemma3:4b" if you haven't already
) else (
    where ollama >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ℹ️  Ollama is installed but not currently running.
        echo      Start it with: ollama serve
    ) else (
        echo   ℹ️  Ollama is not installed.
        echo      📥 Download from: https://ollama.ai/
        echo      Ollama is required for local AI — external providers ^(OpenAI, etc.^) work without it.
    )
)

echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.
echo   ✅  SETUP COMPLETE!
echo.
echo   What to do next:
echo.
echo     1. ^(Optional^) Edit backend\.env to configure API keys and settings
echo     2. ^(Optional^) Start Ollama: ollama serve
echo     3. ^(Optional^) Pull a model: ollama pull gemma3:4b
echo     4. Launch the app: start-lackadaisical-ai.bat
echo.
echo   Quick reference:
echo     start-lackadaisical-ai.bat   — Start all services
echo     stop-lackadaisical-ai.bat    — Stop all services
echo     npm test                     — Run all tests
echo     npm run reset:db             — Wipe and recreate database
echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.
pause
