param(
  [string]$BlenderExe = "",
  [string]$OutDir = "$(Resolve-Path .)\assets\blender",
  [string]$Name = "Ball_v1",
  [double]$RadiusMm = 50
)

# Convert mm to meters (Blender default units)
$radius = [double]$RadiusMm / 1000.0

# Resolve full output directory path
$OutDir = (Resolve-Path -Path $OutDir -ErrorAction SilentlyContinue)
if (-not $OutDir) {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $OutDir = (Resolve-Path -Path $OutDir)
}

# Helper: print friendly error and suggestions
function Fail($msg) {
  Write-Error $msg
  Write-Host "Hints:"
  Write-Host " - Install Blender from https://www.blender.org/download/ or provide the full path to blender.exe using -BlenderExe 'C:\\Path\\to\\blender.exe'"
  Write-Host " - If Blender is on PATH, omit -BlenderExe and the script will try to locate it automatically."
  exit 1
}

# Try to locate Blender executable
if (-not [string]::IsNullOrWhiteSpace($BlenderExe)) {
  if (-not (Test-Path $BlenderExe)) {
    Fail "Blender executable not found at: $BlenderExe"
  }
  $exePath = (Resolve-Path $BlenderExe).ProviderPath
} else {
  $cmd = Get-Command blender -ErrorAction SilentlyContinue
  if ($cmd) {
    $exePath = $cmd.Source
  } else {
    # Check common install locations
    $candidates = @(
      'C:\\Program Files\\Blender Foundation\\Blender\\blender.exe',
      'C:\\Program Files (x86)\\Blender Foundation\\Blender\\blender.exe'
    )
    $found = $null
    foreach ($p in $candidates) {
      if (Test-Path $p) { $found = $p; break }
    }
    if ($found) {
      $exePath = $found
    } else {
      Fail "Could not locate Blender executable on PATH or in common install locations."
    }
  }
}

Write-Host "Using Blender executable: $exePath"
Write-Host "Output directory: $OutDir"

# Build arguments for Blender
$args = @('--background', '--python', (Join-Path -Path (Get-Location) -ChildPath 'scripts\blender\create_ball.py'), '--', $OutDir.ProviderPath, $Name, $radius)

Write-Host "Launching Blender..."
Start-Process -FilePath $exePath -ArgumentList $args -NoNewWindow -Wait -PassThru | Out-Null

if ($LASTEXITCODE -ne 0) {
  Write-Error "Blender exited with code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "Blender script completed. Check output directory: $($OutDir.ProviderPath)"
