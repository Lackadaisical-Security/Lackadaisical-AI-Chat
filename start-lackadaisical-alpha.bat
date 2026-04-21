@echo off
title Lackadaisical AI Chat - Alpha/Dev Quick Start
color 0B

echo.
echo  ═══════════════════════════════════════════════════════════════════════════
echo   🚀 Lackadaisical AI Chat v2.0.0-rc1 - Quick Dev Start
echo   Build Date: April 21, 2026
echo   By Lackadaisical Security - https://lackadaisical-security.com
echo  ═══════════════════════════════════════════════════════════════════════════
echo.

:: Ensure we're in the right directory
cd /d "%~dp0"

if not exist "package.json" (
    echo ❌ ERROR: package.json not found. Run from the project root.
    pause
    exit /b 1
)

:: Quick prerequisite check
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

:: Check Ollama
echo 🔍 Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Ollama not running. Trying to auto-start...
    where ollama >nul 2>nul
    if %errorlevel% equ 0 (
        start "Ollama AI Engine" /min ollama serve
        timeout /t 5 /nobreak >nul
        echo ✅ Ollama start command issued
    ) else (
        echo ⚠️  Ollama not found. Download from https://ollama.ai/
        echo    Continuing without Ollama - external AI providers can still be used.
    )
) else (
    echo ✅ Ollama is running
)

echo.
echo 📦 Checking dependencies...

:: Only install if missing
if not exist "node_modules" call npm install --loglevel=error
if not exist "backend\node_modules" ( cd backend && call npm install --loglevel=error && cd .. )
if not exist "frontend\node_modules" ( cd frontend && call npm install --loglevel=error && cd .. )

:: Ensure database
if not exist "database" mkdir database
if not exist "database\chat.db" call npm run init:db 2>nul

echo.
echo ✅ Dependencies ready!
echo.
echo 🚀 Starting development servers...
echo.
echo   📍 Frontend: http://localhost:3000
echo   📍 Backend:  http://localhost:3001
echo   📍 API Docs: http://localhost:3001/api
echo.
echo ⚡ Features: Chat, Sessions, IDE, Emulator, Journal, Plugins, Web Search
echo 🤖 Commands: /help /checkin /journal /reflect /memory /mood /gratitude /goals
echo.

:: Start services
start "Lackadaisical AI Backend" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 4 /nobreak >nul
start "Lackadaisical AI Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo ⏳ Waiting for services...
timeout /t 6 /nobreak >nul

echo.
echo Press any key to open http://localhost:3000 in your browser...
pause >nul

start http://localhost:3000

echo.
echo 🎉 Lackadaisical AI Chat is running!
echo 📝 To stop: run stop-lackadaisical-ai.bat or close terminal windows.
echo.
pause
