@echo off
title Atlas Arena - Launcher
cd /d "%~dp0"
color 0A

echo ================================================
echo            ATLAS ARENA  -  LAUNCHER
echo ================================================
echo.
echo   Closing any old server / link...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server*index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
taskkill /IM cloudflared.exe /F >nul 2>&1
del cloudflared.log >nul 2>&1

echo   Starting the game server...
start "Atlas Server" cmd /k "node server\index.js"

REM let the server boot before opening the public link
timeout /t 4 >nul

echo   Opening your public link...
start "Atlas Tunnel" /min cmd /c "cloudflared.exe tunnel --url http://localhost:8080 > cloudflared.log 2>&1"

echo   Waiting for the link (about 10 seconds)...
powershell -NoProfile -Command "$u=''; for($i=0;$i -lt 40;$i++){ if(Test-Path 'cloudflared.log'){ $m = Select-String -Path 'cloudflared.log' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1; if($m){ $u=$m.Matches[0].Value; break } }; Start-Sleep -Milliseconds 1500 }; if($u){ try { Set-Clipboard -Value $u } catch {}; Write-Host ''; Write-Host '  ==================================================' -ForegroundColor Yellow; Write-Host '   YOUR LINK  (already copied to clipboard):' -ForegroundColor Yellow; Write-Host ('    ' + $u) -ForegroundColor Cyan; Write-Host '  ==================================================' -ForegroundColor Yellow } else { Write-Host '  Could not read the link automatically.' -ForegroundColor Red; Write-Host '  Open the minimized Atlas Tunnel window to see it.' -ForegroundColor Red }"

echo.
echo   Send that link to your friends.
echo   Keep all windows open while you play.
echo   To stop everything: run STOP-GAME.bat
echo.
pause
