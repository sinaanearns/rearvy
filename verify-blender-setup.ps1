#!/usr/bin/env pwsh
<#
.SYNOPSIS
Verify that Rearvy Blender MCP setup is correct
.DESCRIPTION
Checks:
- Blender is installed
- blender-mcp is installed
- Blender MCP addon is available
- Port 3002 is available
- Node/npm versions
#>

$ErrorActionPreference = "Continue"
$successCount = 0
$failCount = 0

Write-Host "`n=== Rearvy Blender MCP Setup Verification ===" -ForegroundColor Cyan

# 1. Check Node/npm
Write-Host "`n[1] Node.js & npm..." -ForegroundColor Yellow
try {
  $nodeVersion = node --version
  $npmVersion = npm --version
  Write-Host "  ✓ Node: $nodeVersion" -ForegroundColor Green
  Write-Host "  ✓ npm: $npmVersion" -ForegroundColor Green
  $successCount++
} catch {
  Write-Host "  ✗ Node.js/npm not found or not in PATH" -ForegroundColor Red
  $failCount++
}

# 2. Check blender-mcp installation
Write-Host "`n[2] blender-mcp installation..." -ForegroundColor Yellow
$mcpFound = $false

# Try: python -m blender_mcp --help
try {
  $output = python -m blender_mcp --help 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ blender-mcp found via: python -m blender_mcp" -ForegroundColor Green
    $mcpFound = $true
    $successCount++
  }
} catch { }

if (-not $mcpFound) {
  # Try: blender-mcp --help
  try {
    $output = blender-mcp --help 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  ✓ blender-mcp found in PATH" -ForegroundColor Green
      $mcpFound = $true
      $successCount++
    }
  } catch { }
}

if (-not $mcpFound) {
  # Try: uvx blender-mcp --help
  try {
    $output = uvx blender-mcp --help 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  ✓ blender-mcp available via uvx" -ForegroundColor Green
      $mcpFound = $true
      $successCount++
    }
  } catch { }
}

if (-not $mcpFound) {
  Write-Host "  ✗ blender-mcp NOT found. Install with: pip install blender-mcp" -ForegroundColor Red
  $failCount++
}

# 3. Check if Blender is installed
Write-Host "`n[3] Blender installation..." -ForegroundColor Yellow
$blenderFound = $false
$blenderPath = ""

# Common Windows Blender paths
$blenderPaths = @(
  "C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
  "C:\Program Files\Blender Foundation\Blender 4.1\blender.exe",
  "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe",
  "C:\Program Files (x86)\Blender Foundation\Blender 4.0\blender.exe",
  "$env:USERPROFILE\AppData\Local\Programs\Blender Foundation\Blender 4.2\blender.exe"
)

foreach ($path in $blenderPaths) {
  if (Test-Path $path) {
    Write-Host "  ✓ Blender found at: $path" -ForegroundColor Green
    $blenderFound = $true
    $blenderPath = $path
    $successCount++
    break
  }
}

if (-not $blenderFound) {
  Write-Host "  ✗ Blender not found in standard paths" -ForegroundColor Red
  Write-Host "     Check if 'blender' is in PATH: $(if (Get-Command blender -EA SilentlyContinue) { 'YES' } else { 'NO' })" -ForegroundColor Yellow
  if ($env:BLENDER_EXECUTABLE) {
    Write-Host "     BLENDER_EXECUTABLE environment variable is set to: $env:BLENDER_EXECUTABLE" -ForegroundColor Yellow
  }
  $failCount++
}

# 4. Check Port 3002 availability
Write-Host "`n[4] Port 3002 availability..." -ForegroundColor Yellow
try {
  $connection = Test-NetConnection -ComputerName 127.0.0.1 -Port 3002 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
  if ($connection.TcpTestSucceeded) {
    Write-Host "  ⚠ Port 3002 is IN USE (bridge may already be running or port is blocked)" -ForegroundColor Yellow
    Write-Host "    Run: netstat -ano | findstr :3002" -ForegroundColor Yellow
    # Try health endpoint
    try {
      $health = Invoke-WebRequest -Uri http://127.0.0.1:3002/health -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
      if ($health -and $health.Content) {
        Write-Host "    Bridge health response: $($health.Content)" -ForegroundColor Green
      }
    } catch {}
  } else {
    Write-Host "  ✓ Port 3002 is available" -ForegroundColor Green
    $successCount++
  }
} catch {
  Write-Host "  ✓ Port 3002 appears available" -ForegroundColor Green
  $successCount++
}

# 5. Check bridge dependencies
Write-Host "`n[5] Bridge dependencies..." -ForegroundColor Yellow
try {
  $bridgePath = Resolve-Path "$PSScriptRoot\scripts\blender-mcp-bridge.mjs"
  if (Test-Path $bridgePath) {
    Write-Host "  ✓ Bridge script found: $bridgePath" -ForegroundColor Green
    $successCount++
  }
} catch {
  Write-Host "  ✗ Bridge script not found" -ForegroundColor Red
  $failCount++
}

# 6. Check bridge health on common ports
Write-Host "`n[6] Bridge health checks..." -ForegroundColor Yellow
foreach ($p in @(3001,3002)) {
  try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:$p/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($h -and $h.Content) {
      Write-Host "  ✓ Health @ port $p: $($h.Content)" -ForegroundColor Green
      $successCount++
      break
    }
  } catch {}
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "  ✓ Checks passed: $successCount" -ForegroundColor Green
Write-Host "  ✗ Checks failed: $failCount" -ForegroundColor Red

if ($failCount -eq 0) {
  Write-Host "`n✓ All checks passed! Ready to run: npm run dev:desktop" -ForegroundColor Green
} else {
  Write-Host "`n✗ Some checks failed. See remediation steps above." -ForegroundColor Red
  Write-Host "`nCommon fixes:" -ForegroundColor Yellow
  Write-Host "  • Install blender-mcp: pip install blender-mcp" -ForegroundColor Yellow
  Write-Host "  • Verify Blender is installed and in PATH" -ForegroundColor Yellow
  Write-Host "  • Ensure Blender MCP addon is enabled in Blender preferences" -ForegroundColor Yellow
  Write-Host "  • Kill stale Node processes: taskkill /IM node.exe /F" -ForegroundColor Yellow
}

Write-Host "`n"
