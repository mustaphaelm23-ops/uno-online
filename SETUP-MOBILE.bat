@echo off
title Atlas Arena - Mobile (Capacitor) Setup
cd /d "%~dp0"
color 0B
echo ================================================
echo     ATLAS ARENA  -  MOBILE APP SETUP (Android)
echo ================================================
echo.
echo  This wraps the web app into an Android project using Capacitor.
echo  Needs internet (npm) + Android Studio installed to build the APK.
echo.
echo  BEFORE running: set window.ATLAS_SERVER_URL in client\index.html
echo  to your deployed server URL (see MOBILE-APP-GUIDE.md).
echo.
pause

echo.
echo  [1/3] Installing Capacitor...
call npm install @capacitor/core @capacitor/cli @capacitor/android
if errorlevel 1 goto fail

echo.
echo  [2/3] Adding the Android platform...
call npx cap add android
REM (safe to ignore "already exists" if you've run this before)

echo.
echo  [3/3] Syncing the web app into the native project...
call npx cap sync
if errorlevel 1 goto fail

echo.
echo ================================================
echo   DONE. Now open it in Android Studio with:
echo       npx cap open android
echo   Then press the green Run button, or
echo   Build ^> Build Bundle(s)/APK(s) for an install file.
echo ================================================
echo.
echo   (Re-run "npx cap sync" after any change to client\.)
echo.
pause
exit /b 0

:fail
echo.
echo   Something failed. Make sure Node + internet are available,
echo   then read MOBILE-APP-GUIDE.md for the manual steps.
echo.
pause
exit /b 1
