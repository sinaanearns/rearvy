$ErrorActionPreference = "Continue"
$successCount = 0
$failCount = 0

Write-Host "`n=== Rearvy Blender MCP Setup Verification ===" -ForegroundColor Cyan

# 1) Node/npm
Write-Host "`n[1] Node.js and npm" -ForegroundColor Yellow
try {
  $nodeVersion = node --version
  $npmVersion = npm --version
  Write-Host "  OK Node: $nodeVersion" -ForegroundColor Green
  Write-Host "  OK npm: $npmVersion" -ForegroundColor Green
  $successCount++
} catch {
  Write-Host "  FAIL Node.js/npm not found in PATH" -ForegroundColor Red
  $failCount++
}

# 2) blender-mcp
Write-Host "`n[2] blender-mcp installation" -ForegroundColor Yellow
$mcpFound = $false

try {
  python -c "import blender_mcp" *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK blender-mcp import works via python" -ForegroundColor Green
    $mcpFound = $true
    $successCount++
  }
} catch {}

if (-not $mcpFound) {
  try {
    blender-mcp --help *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  OK blender-mcp command in PATH" -ForegroundColor Green
      $mcpFound = $true
      $successCount++
    }
  } catch {}
}

if (-not $mcpFound) {
  try {
    uvx blender-mcp --help *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  OK blender-mcp via uvx" -ForegroundColor Green
      $mcpFound = $true
      $successCount++
    }
  } catch {}
}

if (-not $mcpFound) {
  Write-Host "  FAIL blender-mcp not found. Run: pip install blender-mcp" -ForegroundColor Red
  $failCount++
}

# 3) Blender binary
Write-Host "`n[3] Blender installation" -ForegroundColor Yellow
$blenderFound = $false
$blenderPath = ""
$blenderPaths = @(
  "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe",
  "C:\Program Files\Blender Foundation\Blender 4.1\blender.exe",
  "C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
  "C:\Program Files (x86)\Blender Foundation\Blender 4.2\blender.exe",
  "$env:USERPROFILE\AppData\Local\Programs\Blender Foundation\Blender 4.2\blender.exe"
)

foreach ($candidate in $blenderPaths) {
  if (Test-Path $candidate) {
    $blenderFound = $true
    $blenderPath = $candidate
    Write-Host "  OK Blender found: $candidate" -ForegroundColor Green
    $successCount++
    break
  }
}

if (-not $blenderFound) {
  $inPath = if (Get-Command blender -ErrorAction SilentlyContinue) { "YES" } else { "NO" }
  Write-Host "  FAIL Blender not found in known paths" -ForegroundColor Red
  Write-Host "  blender in PATH: $inPath" -ForegroundColor Yellow
  if ($env:BLENDER_EXECUTABLE) {
    Write-Host "  BLENDER_EXECUTABLE: $env:BLENDER_EXECUTABLE" -ForegroundColor Yellow
  }
  $failCount++
}

# 4) Bridge port and health
Write-Host "`n[4] Bridge health checks" -ForegroundColor Yellow
$healthFound = $false
foreach ($p in @(3002, 3001)) {
  try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:${p}/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($health -and $health.Content) {
      Write-Host "  OK health at port ${p}: $($health.Content)" -ForegroundColor Green
      $healthFound = $true
      $successCount++
      break
    }
  } catch {}
}

if (-not $healthFound) {
  Write-Host "  INFO no running bridge health endpoint on ports 3002/3001" -ForegroundColor Yellow
}

# 5) Bridge script presence
Write-Host "`n[5] Bridge script file" -ForegroundColor Yellow
$bridgeScript = Join-Path $PSScriptRoot "scripts\blender-mcp-bridge.mjs"
if (Test-Path $bridgeScript) {
  Write-Host "  OK found: $bridgeScript" -ForegroundColor Green
  $successCount++
} else {
  Write-Host "  FAIL missing: $bridgeScript" -ForegroundColor Red
  $failCount++
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "  Passed: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red

if ($failCount -eq 0) {
  Write-Host "`nReady: npm run dev:desktop" -ForegroundColor Green
} else {
  Write-Host "`nFix failures above, then rerun this script." -ForegroundColor Yellow
}

Write-Host ""
