@echo off
title UNO Online - Setup ngrok
cd /d "%~dp0"

if exist ngrok.exe (
    REM Treat a 0-byte stub the same as missing.
    for %%A in (ngrok.exe) do if %%~zA gtr 0 (
        echo ngrok.exe is already installed in this folder.
        echo To replace it, delete ngrok.exe and re-run this script.
        echo.
        pause
        exit /b 0
    )
    del /f /q ngrok.exe >nul 2>&1
)

echo.
echo === Downloading ngrok (Windows x64) ===
echo This is a one-time setup, takes about 30 seconds.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Write-Host 'Downloading...';" ^
  "Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile 'ngrok-temp.zip' -UseBasicParsing;" ^
  "Write-Host 'Extracting...';" ^
  "Expand-Archive -Path 'ngrok-temp.zip' -DestinationPath '.' -Force;" ^
  "Remove-Item 'ngrok-temp.zip' -Force;" ^
  "Write-Host 'Done.'"

if not exist ngrok.exe (
    echo.
    echo [ERROR] Download or extract failed. Check your internet connection
    echo         and try again. You can also install ngrok manually from:
    echo         https://ngrok.com/download
    pause
    exit /b 1
)

echo.
echo ============================================
echo   ngrok.exe is installed in this folder.
echo.
echo   To share the game over the internet:
echo     1) Make sure the server is running (start.bat)
echo     2) Double-click share.bat
echo.
echo   First-time only: you'll need a free ngrok auth token from
echo   https://dashboard.ngrok.com/get-started/your-authtoken
echo   then run once:  ngrok config add-authtoken YOUR_TOKEN
echo ============================================
echo.
pause
