@echo off
REM Quick setup and build for Rearvy with code signing
REM This script does everything needed to build a signed app for users

echo.
echo ========================================
echo   Rearvy Build with Code Signing
echo ========================================
echo.

REM Check if PowerShell setup was run
if not exist "%USERPROFILE%\rearvy-dev-cert.pfx" (
    echo Setting up code signing certificate...
    powershell -NoProfile -ExecutionPolicy Bypass -File "setup-code-signing.ps1"
    if errorlevel 1 (
        echo ERROR: Setup failed. Please run:
        echo   powershell -NoProfile -ExecutionPolicy Bypass -File "setup-code-signing.ps1"
        pause
        exit /b 1
    )
)

echo.
echo Installing dependencies...
call npm install

if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo Building signed Windows app...
call npm run build:win

if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo ✓ Signed app created in: desktop-release\
echo.
echo Your users can now:
echo  1. Download and run the .exe
echo  2. Click "Run anyway" on Windows warning (if it appears)
echo  3. Give terminal access to Rearvy when prompted
echo.
echo To remove the warning for users, give them:
echo  - setup-windows-defender.bat (they run as admin once)
echo  - USER_SETUP_GUIDE.md (instructions)
echo.
pause
