@echo off
echo Starting HandSpace...

:: 1. Start with bundled Node.js static server (no downloads)
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Node.js detected. Starting local static server...
    if not exist node_modules\three\build\three.module.js (
        echo Missing dependencies. Run: npm install
        pause
        goto :EOF
    )
    start "" "http://localhost:8000"
    node tools\static-server.mjs --port 8000
    goto :EOF
)

:: 2. Fallback to Python if Node is missing
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Node.js not found. Python detected. Starting with python...
    start "" "http://localhost:8000"
    python -m http.server 8000
    goto :EOF
)

:: 3. If neither found
echo Error: Neither Node.js nor Python was found.
echo Please install Node.js (recommended) or Python to run this project.
pause
