@echo off
title Lackadaisical AI Chat - Stop Script
color 0C

echo.
echo  ═══════════════════════════════════════════════════════════════════════════
echo   🛑 Lackadaisical AI Chat - Shutdown
echo   Stopping all services...
echo  ═══════════════════════════════════════════════════════════════════════════
echo.

:: Stop Node.js processes on known ports
echo  🔍 Looking for running services...
echo.

:: Kill backend (port 3001)
set "BACKEND_KILLED=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING" 2^>nul') do (
    echo   Stopping Backend (PID: %%a) on port 3001...
    taskkill /PID %%a /F >nul 2>&1
    set "BACKEND_KILLED=true"
)
if "%BACKEND_KILLED%"=="true" (
    echo   ✅ Backend stopped
) else (
    echo   ℹ️  Backend was not running on port 3001
)

:: Kill frontend dev server (port 3000)
set "FRONTEND_KILLED=false"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    echo   Stopping Frontend (PID: %%a) on port 3000...
    taskkill /PID %%a /F >nul 2>&1
    set "FRONTEND_KILLED=true"
)
if "%FRONTEND_KILLED%"=="true" (
    echo   ✅ Frontend stopped
) else (
    echo   ℹ️  Frontend was not running on port 3000
)

echo.

:: Optionally stop Ollama
echo  🤖 Ollama Management:
echo.
set /p "STOP_OLLAMA=  Stop Ollama as well? (y/n): "
if /i "%STOP_OLLAMA%"=="y" (
    set "OLLAMA_KILLED=false"
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":11434" ^| findstr "LISTENING" 2^>nul') do (
        echo   Stopping Ollama (PID: %%a) on port 11434...
        taskkill /PID %%a /F >nul 2>&1
        set "OLLAMA_KILLED=true"
    )
    :: Also try by process name
    taskkill /IM ollama.exe /F >nul 2>&1
    if not "%OLLAMA_KILLED%"=="true" (
        echo   ℹ️  Ollama was not running
    ) else (
        echo   ✅ Ollama stopped
    )
) else (
    echo   ⏭️  Leaving Ollama running
)

:: Close terminal windows opened by start script
echo.
echo  🧹 Closing related terminal windows...
taskkill /FI "WINDOWTITLE eq Lackadaisical AI*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Ollama AI Engine" /F >nul 2>&1

echo.
echo  ═══════════════════════════════════════════════════════════════════════════
echo   ✅ All Lackadaisical AI Chat services have been stopped.
echo.
echo   To restart, run: start-lackadaisical-ai.bat
echo  ═══════════════════════════════════════════════════════════════════════════
echo.
pause
