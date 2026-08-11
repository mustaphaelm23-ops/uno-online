@echo off
title Atlas Arena - Stop
cd /d "%~dp0"
color 0C
echo   Stopping Atlas Arena (server + link)...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server*index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
taskkill /IM cloudflared.exe /F >nul 2>&1
echo   Done. Everything is stopped.
timeout /t 2 >nul
