@echo off
title UNO Online - Public Share via ngrok
cd /d "%~dp0"

if not exist ngrok.exe (
    echo.
    echo [ERROR] ngrok.exe not found.
    echo         Run setup-ngrok.bat first to install it.
    echo.
    pause
    exit /b 1
)

REM Your reserved free ngrok domain. ngrok always tunnels to this same
REM hostname so the URL stays stable across restarts (no need to send
REM friends a new random URL every time).
set NGROK_DOMAIN=twitch-vacancy-unnerve.ngrok-free.dev

echo.
echo ============================================
echo   Starting ngrok tunnel on http://localhost:8080
echo.
echo   Public URL:  https://%NGROK_DOMAIN%
echo.
echo   Share that URL with anyone -- it forwards to your local server.
echo   Press Ctrl+C in this window to stop the tunnel.
echo   (Make sure start.bat is already running.)
echo ============================================
echo.

.\ngrok.exe http --domain=%NGROK_DOMAIN% 8080
pause
