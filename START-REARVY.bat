@echo off
REM Rearvy Desktop - Auto Start Script
REM Double-click this to launch everything automatically

echo.
echo ========================================
echo   REARVY DESKTOP - Auto Start
echo ========================================
echo.

REM Get the project directory
cd /d "%~dp0"

echo [INFO] Cleaning up stale Node/Electron processes...
taskkill /IM node.exe /F 2>nul
taskkill /IM electron.exe /F 2>nul
timeout /t 1 /nobreak

echo [INFO] Checking for required dependencies...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found in PATH
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Checking for Python (needed for blender-mcp)...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Python not found in PATH
    echo blender-mcp requires Python. Install from: https://www.python.org/
    echo Continue? Press any key...
    pause
)

echo.
echo [INFO] Starting Rearvy Desktop...
echo [INFO] - Auto-launching Blender
echo [INFO] - Starting development server
echo [INFO] - App will open at: http://localhost:3000
echo.
echo This window will stay open to show debug messages.
echo You can close it anytime - the app will keep running.
echo.

REM Run the dev command
call npm run dev:desktop

REM If we get here, the process ended
echo.
echo [INFO] Rearvy Desktop closed
pause
