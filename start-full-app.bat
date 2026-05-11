@echo off
REM Rearvy Full App Start Script
REM Starts both website dev server and desktop app

title Rearvy - Website Dev + Desktop
setlocal

cd /d "%~dp0"

REM Kill any existing processes
taskkill /IM electron.exe /F 2>nul
taskkill /IM node.exe /F 2>nul
timeout /t 1

REM Start website dev server in background  
echo Starting website dev server on port 3000...
start "Rearvy Website" cmd /k "npm run dev:web"
timeout /t 3

REM Start desktop app
echo.
echo Starting Rearvy Desktop...
npm run dev:desktop

pause
