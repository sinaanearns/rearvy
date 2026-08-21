@echo off
REM Create Desktop Shortcut for Rearvy
REM Run this ONCE to create a desktop shortcut

echo Creating desktop shortcut for Rearvy...

REM Get paths
set SCRIPT_PATH=%~dp0START-REARVY.bat
set DESKTOP_PATH=%USERPROFILE%\Desktop
set SHORTCUT_PATH=%DESKTOP_PATH%\Rearvy Desktop.lnk

REM Use PowerShell to create the shortcut (more reliable than VBS)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$Shortcut.TargetPath = '%SCRIPT_PATH%'; " ^
  "$Shortcut.WorkingDirectory = '%~dp0'; " ^
  "$Shortcut.Description = 'Launch Rearvy Desktop App'; " ^
  "$Shortcut.IconLocation = '%~dp0public\rearvy.ico'; " ^
  "$Shortcut.Save(); " ^
  "Write-Host 'Shortcut created successfully!'"

echo.
if exist "%SHORTCUT_PATH%" (
    echo SUCCESS! Shortcut created on desktop: %SHORTCUT_PATH%
    echo.
    echo You can now double-click "Rearvy Desktop" on your desktop to start everything!
) else (
    echo ERROR: Could not create shortcut
)

pause
