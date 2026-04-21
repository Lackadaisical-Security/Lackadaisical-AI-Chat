@echo off
title Lackadaisical AI Chat - Enterprise Startup Script
color 0A
setlocal EnableDelayedExpansion

echo.
echo  ██╗      █████╗  ██████╗██╗  ██╗ █████╗ ██████╗  █████╗ ██╗███████╗██╗ ██████╗ █████╗ ██╗     
echo  ██║     ██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗██║██╔════╝██║██╔════╝██╔══██╗██║     
echo  ██║     ███████║██║     █████╔╝ ███████║██║  ██║███████║██║███████╗██║██║     ███████║██║     
echo  ██║     ██╔══██║██║     ██╔═██╗ ██╔══██║██║  ██║██╔══██║██║╚════██║██║██║     ██╔══██║██║     
echo  ███████╗██║  ██║╚██████╗██║  ██╗██║  ██║██████╔╝██║  ██║██║███████║██║╚██████╗██║  ██║███████╗
echo  ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝
echo.
echo                              AI CHAT v2.0.0 - Your Personal Companion
echo                              By Lackadaisical Security 2025-2026
echo                              https://lackadaisical-security.com
echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.

:: Record start time for PID tracking
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 1: System Requirements Check
:: ────────────────────────────────────────────────────────────────────────────
echo [1/7] 🔍 Checking system requirements...
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ ERROR: Node.js is not installed or not in PATH!
    echo      📥 Download from: https://nodejs.org/ (v18+ required)
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo   ✅ Node.js: %NODE_VER%

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ ERROR: npm is not available!
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set "NPM_VER=%%v"
echo   ✅ npm: %NPM_VER%

:: Check if package.json exists (correct directory)
if not exist "package.json" (
    echo   ❌ ERROR: package.json not found - please run from the project root.
    pause
    exit /b 1
)

echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 2: Ollama Auto-Start
:: ────────────────────────────────────────────────────────────────────────────
echo [2/7] 🤖 Checking Ollama AI engine...
echo.

set "OLLAMA_STARTED_BY_US=false"

:: Check if Ollama is already running
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Ollama is running and accessible
    goto :ollama_ready
)

:: Try to find and auto-start Ollama
echo   ⚠️  Ollama is not running. Attempting auto-start...

:: Check common install locations
set "OLLAMA_PATH="
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    set "OLLAMA_PATH=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
)
if exist "%ProgramFiles%\Ollama\ollama.exe" (
    set "OLLAMA_PATH=%ProgramFiles%\Ollama\ollama.exe"
)
where ollama >nul 2>&1
if %errorlevel% equ 0 (
    set "OLLAMA_PATH=ollama"
)

if defined OLLAMA_PATH (
    echo   🚀 Starting Ollama from: %OLLAMA_PATH%
    start "Ollama AI Engine" /min "%OLLAMA_PATH%" serve
    set "OLLAMA_STARTED_BY_US=true"
    
    :: Wait for Ollama to become available (up to 30 seconds)
    echo   ⏳ Waiting for Ollama to initialize...
    set "OLLAMA_READY=false"
    for /l %%i in (1,1,15) do (
        timeout /t 2 /nobreak >nul
        curl -s http://localhost:11434/api/tags >nul 2>&1
        if !errorlevel! equ 0 (
            set "OLLAMA_READY=true"
            goto :ollama_check_done
        )
        echo   ... waiting (%%i/15)
    )
    :ollama_check_done
    if "!OLLAMA_READY!"=="true" (
        echo   ✅ Ollama started successfully!
    ) else (
        echo   ⚠️  Ollama started but may still be loading. Continuing...
    )
) else (
    echo   ⚠️  Ollama not found. AI features require Ollama.
    echo      📥 Download from: https://ollama.ai/
    echo.
    set /p "CONTINUE_NO_OLLAMA=   Continue without Ollama? (y/n): "
    if /i "!CONTINUE_NO_OLLAMA!" neq "y" (
        echo   🛑 Startup cancelled.
        pause
        exit /b 1
    )
)

:ollama_ready
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 3: Check for default model
:: ────────────────────────────────────────────────────────────────────────────
echo [3/7] 🧠 Checking AI models...
echo.

curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Ollama API accessible — models can be pulled from Settings or CLI
    echo      Tip: Run "ollama pull gemma3:4b" for a lightweight test model
) else (
    echo   ⏭️  Skipping model check (Ollama not available)
)
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 4: Install dependencies
:: ────────────────────────────────────────────────────────────────────────────
echo [4/7] 📦 Checking dependencies...
echo.

:: Root dependencies
if not exist "node_modules" (
    echo   📥 Installing root dependencies...
    call npm install --loglevel=error
    if %errorlevel% neq 0 (
        echo   ❌ Failed to install root dependencies!
        pause
        exit /b 1
    )
)

:: Backend dependencies
if not exist "backend\node_modules" (
    echo   📥 Installing backend dependencies...
    cd backend
    call npm install --loglevel=error
    if %errorlevel% neq 0 (
        echo   ❌ Failed to install backend dependencies!
        pause
        exit /b 1
    )
    cd ..
)

:: Frontend dependencies
if not exist "frontend\node_modules" (
    echo   📥 Installing frontend dependencies...
    cd frontend
    call npm install --loglevel=error
    if %errorlevel% neq 0 (
        echo   ❌ Failed to install frontend dependencies!
        pause
        exit /b 1
    )
    cd ..
)

echo   ✅ All dependencies ready!
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 5: Initialize database
:: ────────────────────────────────────────────────────────────────────────────
echo [5/7] 🗃️  Checking database...
echo.

if not exist "database" mkdir database
if not exist "database\chat.db" (
    echo   📥 Initializing database...
    call npm run init:db 2>nul
    echo   ✅ Database initialized
) else (
    echo   ✅ Database exists
)
echo.

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 6: Start services
:: ────────────────────────────────────────────────────────────────────────────
echo [6/7] 🔄 Starting services...
echo.

:: Start backend
echo   🖥️  Starting Backend Server (Port 3001)...
start "Lackadaisical AI - Backend" cmd /k "cd /d "%SCRIPT_DIR%backend" && npm start"
timeout /t 4 /nobreak >nul

:: Start frontend
echo   🌐 Starting Frontend Dev Server (Port 3000)...
start "Lackadaisical AI - Frontend" cmd /k "cd /d "%SCRIPT_DIR%frontend" && npm run dev"

echo.
echo   ⏳ Waiting for services to initialize...
timeout /t 6 /nobreak >nul

:: ────────────────────────────────────────────────────────────────────────────
:: STEP 7: Health check and launch
:: ────────────────────────────────────────────────────────────────────────────
echo [7/7] 🔍 Verifying services...
echo.

curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ Backend is healthy and responding!
) else (
    echo   ⚠️  Backend may still be starting up...
)

echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.
echo  🎉 Lackadaisical AI Chat v2.0.0 is starting!
echo.
echo  📍 Frontend:     http://localhost:3000
echo  📍 Backend API:  http://localhost:3001
echo  📍 API Docs:     http://localhost:3001/api
echo  📍 Health:       http://localhost:3001/health
echo  📍 Ollama:       http://localhost:11434
echo.
echo  🤖 Features Available:
echo     Chat • Sessions • IDE • Emulator • Journal • Plugins
echo     Web Search • File Upload • Image Gen • Extended Thinking
echo.
echo  💡 Commands: /help /checkin /journal /reflect /memory /mood /gratitude /goals
echo.
echo  ═══════════════════════════════════════════════════════════════════════════════════════════════
echo.
echo  Press any key to open the application in your browser...
pause >nul

:: Open browser
start http://localhost:3000

echo.
echo  🎯 Application launched! Check your browser.
echo.
echo  📝 To stop all services, run: stop-lackadaisical-ai.bat
echo     Or close the Backend and Frontend terminal windows.
echo.
if "%OLLAMA_STARTED_BY_US%"=="true" (
    echo  ℹ️  Ollama was auto-started by this script and will continue running.
    echo     To stop Ollama: close the "Ollama AI Engine" terminal window.
    echo.
)
pause
