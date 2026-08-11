@echo off
title UNO Online - React Dev (Vite + Backend)
cd /d "%~dp0"

REM First-time setup: backend deps
if not exist node_modules (
    echo === Installing backend deps (first run) ===
    call npm install
    if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
)

REM First-time setup: React app deps
if not exist client-react\node_modules (
    echo === Installing React deps (first run) ===
    pushd client-react
    call npm install
    if errorlevel 1 ( echo [ERROR] npm install failed in client-react. & popd & pause & exit /b 1 )
    popd
)

REM Launch the backend (Node server on :8080) in its own window
echo === Starting backend on :8080 ===
start "UNO Backend (port 8080)" cmd /k "title UNO Backend (port 8080) && npm start"

REM Give the backend a moment to bind before the React app starts so
REM the first /api request from the proxy doesn't 502.
timeout /t 3 /nobreak >nul

REM Schedule the browser to open on :5173 (React) once Vite is ready
start "" /min cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"

echo.
echo ============================================
echo   Backend:  http://localhost:8080  (separate window)
echo   React UI: http://localhost:5173  (this window)
echo   Browser will open automatically.
echo   Press Ctrl+C here to stop the React dev server.
echo   (Backend keeps running until you close its window.)
echo ============================================
echo.

REM Launch the React dev server in THIS window (foreground)
cd /d "%~dp0client-react"
call npm run dev
pause
