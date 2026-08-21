@echo off
echo Cleaning up existing Node/Electron processes...
taskkill /IM node.exe /F 2>nul
taskkill /IM electron.exe /F 2>nul
timeout /t 2 /nobreak
echo Starting full app dev...
call npm run dev:both
