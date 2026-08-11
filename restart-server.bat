@echo off
REM ═══════════════════════════════════════════════════════════════════
REM  UNO Online — clean server restart
REM  Kills ANY running node.exe process (which is the main culprit
REM  behind "server still running old code" complaints), then boots
REM  a fresh node instance from this directory.
REM ═══════════════════════════════════════════════════════════════════
title UNO Online — Restart Server
cd /d "%~dp0"

echo.
echo === Killing every running node.exe (so stale code can't sit) ===
taskkill /F /IM node.exe >nul 2>&1
if errorlevel 1 (
    echo No node.exe processes were running.
) else (
    echo Node processes terminated.
)

REM Wait a brief beat so Windows fully releases the port + handles.
timeout /t 1 /nobreak >nul

echo.
echo === Starting fresh server ===
echo Watch for the BUILD-335 banner below — if you see a DIFFERENT build
echo number, the wrong file got loaded. CTRL+C and run this again.
echo.

call npm start
pause
