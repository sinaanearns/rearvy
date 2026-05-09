Blender automation: create_ball
===============================

This folder contains a small Blender automation script and a PowerShell wrapper to create a simple ball asset.

Files:
- `create_ball.py` — Blender Python script that creates a UV sphere, assigns a basic material, saves a .blend, exports glTF (.glb), and renders a preview image.
- `run_create_ball.ps1` — Windows PowerShell wrapper to invoke Blender headless and run the script. Defaults to `blender` on PATH.

Usage (Windows PowerShell):

```powershell
# Run with default options
.\scripts\blender\run_create_ball.ps1

# Specify a different Blender executable path, output directory, name, and radius (mm)
.\scripts\blender\run_create_ball.ps1 -BlenderExe "C:\\Program Files\\Blender Foundation\\Blender\\blender.exe" -OutDir ".\\assets\\ball" -Name "Ball_v1" -RadiusMm 50
```

Notes:
- The Python script must be executed by Blender's bundled Python (i.e., via the `blender` binary). Running `python` directly will fail because `bpy` is not available.
- Radius is in meters for the Blender script; `run_create_ball.ps1` accepts millimeters for convenience.
