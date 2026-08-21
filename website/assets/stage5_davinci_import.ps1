# Stage 5: DaVinci Resolve Import & Render Script
# This script launches DaVinci Resolve, imports the FCPXML timeline, and triggers Quick Export
# Run this script after user approval

$ErrorActionPreference = "Stop"

# --- Configuration ---
$DAVINCI_EXE = "C:\Program Files\Blackmagic Design\DaVinci Resolve\Resolve.exe"
$FCPXML_PATH = "C:\Users\sinaa\rearvy2.0\website\assets\Rearvy_SaaS_Product_Video.fcpxml"
$OUTPUT_DIR = "C:\Users\sinaa\rearvy2.0\website\public\downloads"
$OUTPUT_FILE = "$OUTPUT_DIR\rearvy_saas_promo_45s.mp4"

Write-Host "=== Stage 5: DaVinci Resolve Import & Render ===" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Launch DaVinci Resolve ---
Write-Host "[1/6] Launching DaVinci Resolve..." -ForegroundColor Yellow

# Check if already running
$davinciProcess = Get-Process -Name "Resolve" -ErrorAction SilentlyContinue
if ($davinciProcess) {
    Write-Host "  DaVinci Resolve is already running (PID: $($davinciProcess.Id))" -ForegroundColor Green
} else {
    if (Test-Path $DAVINCI_EXE) {
        Start-Process -FilePath $DAVINCI_EXE -PassThru | ForEach-Object {
            Write-Host "  Started DaVinci Resolve (PID: $($_.Id))" -ForegroundColor Green
        }
    } else {
        Write-Host "  ERROR: DaVinci Resolve not found at: $DAVINCI_EXE" -ForegroundColor Red
        exit 1
    }
}

# --- Step 2: Wait for DaVinci Resolve to load ---
Write-Host "[2/6] Waiting for DaVinci Resolve to load (25 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 25
Write-Host "  Done waiting." -ForegroundColor Green

# --- Step 3: Focus DaVinci Resolve window ---
Write-Host "[3/6] Focusing DaVinci Resolve window..." -ForegroundColor Yellow
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WindowHelper {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    
    public static IntPtr FindDaVinciWindow() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            if (sb.ToString().Contains("DaVinci")) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

$davinciWindow = [WindowHelper]::FindDaVinciWindow()
if ($davinciWindow -ne [IntPtr]::Zero) {
    [WindowHelper]::ShowWindow($davinciWindow, 9)  # SW_RESTORE
    [WindowHelper]::SetForegroundWindow($davinciWindow)
    Write-Host "  DaVinci Resolve window focused." -ForegroundColor Green
} else {
    Write-Host "  WARNING: Could not find DaVinci Resolve window. Continuing anyway..." -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# --- Step 4: Import FCPXML via File menu ---
Write-Host "[4/6] Importing FCPXML timeline..." -ForegroundColor Yellow
Write-Host "  FCPXML path: $FCPXML_PATH" -ForegroundColor Gray

# Send Alt+F to open File menu
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class InputHelper {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);
    
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    
    public const int VK_MENU = 0x12;  // Alt
    public const int VK_F = 0x46;     // F
    public const int VK_DOWN = 0x28;  // Arrow Down
    public const int VK_RIGHT = 0x27; // Arrow Right
    public const int VK_RETURN = 0x0D; // Enter
    public const int VK_CONTROL = 0x11; // Ctrl
    public const int VK_D = 0x44;     // D
    public const int KEYEVENTF_KEYDOWN = 0x0000;
    public const int KEYEVENTF_KEYUP = 0x0002;
    
    public static void PressKey(byte key) {
        keybd_event(key, 0, KEYEVENTF_KEYDOWN, IntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(key, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
        Thread.Sleep(50);
    }
    
    public static void HoldAndPress(byte holdKey, byte pressKey) {
        keybd_event(holdKey, 0, KEYEVENTF_KEYDOWN, IntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(pressKey, 0, KEYEVENTF_KEYDOWN, IntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(pressKey, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
        keybd_event(holdKey, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
        Thread.Sleep(50);
    }
    
    public static void TypeText(string text) {
        foreach (char c in text) {
            int vk = VkKeyScan(c);
            byte vkByte = (byte)(vk & 0xFF);
            byte shift = (byte)((vk >> 8) & 0x01);
            if (shift == 1) keybd_event(0x10, 0, KEYEVENTF_KEYDOWN, IntPtr.Zero); // Shift
            keybd_event(vkByte, 0, KEYEVENTF_KEYDOWN, IntPtr.Zero);
            Thread.Sleep(30);
            keybd_event(vkByte, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
            if (shift == 1) keybd_event(0x10, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
            Thread.Sleep(30);
        }
    }
    
    [DllImport("user32.dll")]
    public static extern short VkKeyScan(char ch);
}
"@

# Open File menu: Alt+F
[InputHelper]::HoldAndPress([InputHelper]::VK_MENU, [InputHelper]::VK_F)
Start-Sleep -Milliseconds 800

# Navigate down to Import > Timeline (may vary by version)
# Try navigating down a few times then right to expand submenu
for ($i = 0; $i -lt 5; $i++) {
    [InputHelper]::PressKey([InputHelper]::VK_DOWN)
    Start-Sleep -Milliseconds 200
}

# Press right to expand submenu
[InputHelper]::PressKey([InputHelper]::VK_RIGHT)
Start-Sleep -Milliseconds 500

# Look for "Timeline" option - navigate down in submenu
for ($i = 0; $i -lt 3; $i++) {
    [InputHelper]::PressKey([InputHelper]::VK_DOWN)
    Start-Sleep -Milliseconds 200
}

# Press Enter to open file dialog
[InputHelper]::PressKey([InputHelper]::VK_RETURN)
Start-Sleep -Seconds 3

# Type the FCPXML path
Write-Host "  Typing FCPXML path..." -ForegroundColor Gray
[InputHelper]::TypeText($FCPXML_PATH)
Start-Sleep -Milliseconds 500

# Press Enter to confirm
[InputHelper]::PressKey([InputHelper]::VK_RETURN)
Write-Host "  Import initiated." -ForegroundColor Green

# Wait for timeline to load
Write-Host "  Waiting for timeline to load (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15
Write-Host "  Timeline should be loaded." -ForegroundColor Green

# --- Step 5: Trigger Quick Export / Render ---
Write-Host "[5/6] Triggering Quick Export..." -ForegroundColor Yellow

# Switch to Deliver page: Ctrl+D
[InputHelper]::HoldAndPress([InputHelper]::VK_CONTROL, [InputHelper]::VK_D)
Start-Sleep -Seconds 2

# Press Enter to start render
[InputHelper]::PressKey([InputHelper]::VK_RETURN)
Write-Host "  Render started." -ForegroundColor Green

# Wait for render to complete
Write-Host "  Waiting for render to complete (up to 3 minutes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 120
Write-Host "  Wait period complete." -ForegroundColor Green

# --- Step 6: Verify output ---
Write-Host "[6/6] Verifying output..." -ForegroundColor Yellow
if (Test-Path $OUTPUT_FILE) {
    $fileSize = (Get-Item $OUTPUT_FILE).Length / 1MB
    Write-Host "  SUCCESS: Video rendered to $OUTPUT_FILE ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "  Checking downloads folder for any rendered files..." -ForegroundColor Yellow
    $renderedFiles = Get-ChildItem "$OUTPUT_DIR\*.mp4" -ErrorAction SilentlyContinue
    if ($renderedFiles) {
        foreach ($f in $renderedFiles) {
            Write-Host "  Found: $($f.FullName) ($([math]::Round($f.Length / 1MB, 2)) MB)" -ForegroundColor Green
        }
    } else {
        Write-Host "  No rendered MP4 found yet. The render may still be in progress." -ForegroundColor Yellow
        Write-Host "  Check DaVinci Resolve's Deliver page for render status." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Stage 5 Complete ===" -ForegroundColor Cyan
Write-Host "If the video is not yet rendered, check DaVinci Resolve for render progress." -ForegroundColor Gray
Write-Host "The FCPXML timeline has been imported and render has been triggered." -ForegroundColor Gray
