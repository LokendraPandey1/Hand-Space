@echo off
echo Starting HandSpace Backend and App...

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is required but not found.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo Installing dependencies (if missing)...
if not exist "node_modules" (
    call npm install
)

echo.
echo ===================================================
echo   HandSpace Server Starting on Port 5000...
echo   Please wait for "MongoDB Connected" message
echo ===================================================
echo.

:: Start Server and Open Browser in parallel
start "" "http://localhost:5000/login.html"
node server/server.js

pause
