@echo off
REM Rearvy - Setup Script for Windows Defender Exclusion
REM This script adds Rearvy to Windows Defender so it runs without warnings
REM Right-click this file and select "Run as administrator"

echo.
echo ========================================
echo   Rearvy - Windows Defender Setup
echo ========================================
echo.

REM Check if running as admin
openfiles >nul 2>&1
if errorlevel 1 (
    echo ERROR: This script requires Administrator privileges!
    echo.
    echo Please:
    echo 1. Right-click this file
    echo 2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM Get Rearvy installation path
for /f "tokens=2*" %%A in ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Rearvy" /v InstallLocation 2^>nul') do set "REARVY_PATH=%%B"

if "%REARVY_PATH%"=="" (
    set "REARVY_PATH=%ProgramFiles%\Rearvy"
)

echo Adding Rearvy to Windows Defender exclusions...
echo Path: %REARVY_PATH%
echo.

powershell -NoProfile -Command "Add-MpPreference -ExclusionPath '%REARVY_PATH%' -ErrorAction SilentlyContinue" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ SUCCESS! Rearvy is now excluded from Windows Defender
    echo.
    echo You can now run Rearvy without any security warnings.
    echo.
) else (
    echo.
    echo ERROR: Could not add exclusion. Possible reasons:
    echo - Windows Defender is disabled
    echo - Rearvy installation path not found
    echo.
    echo Try running Rearvy once - it should work normally.
    echo.
)

pause
