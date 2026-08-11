@echo off
title Cardora Server (auto-restart guardian)
cd /d "%~dp0"
echo ==================================================
echo   CARDORA SERVER - auto-restart guardian
echo.
echo   If the server crashes or is killed, it comes
echo   back by itself in 3 seconds.
echo.
echo   Close THIS window to stop the server for real.
echo   (Always start the server with THIS file, not
echo    "node server\index.js")
echo ==================================================
:loop
echo [%date% %time%] starting server >> server-restarts.log
node server\index.js
echo [%date% %time%] server exited (code %errorlevel%) - restarting in 3s >> server-restarts.log
echo.
echo Server stopped (crash or kill) - restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
