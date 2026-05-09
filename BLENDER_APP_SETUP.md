# Blender MCP Bridge Setup for Rearvy Desktop App

## Issue
The Rearvy app fails to connect to Blender while localhost/CLI works. This is because:

1. **Bridge missing `blender-mcp`** — The bridge can't find the Blender MCP server executable
2. **Blender not running** — No Blender instance to connect to
3. **MCP addon not loaded** — Blender is running but the addon is inactive

## Prerequisites

### 1. Install blender-mcp globally (or in PATH)
```powershell
# Option A: Install via uv (recommended)
pip install uv
uvx blender-mcp  # First run to verify it works

# Option B: Install via pip
pip install blender-mcp
```

### 2. Ensure Blender is running
- Launch Blender manually or set it to auto-start
- Blender must be running BEFORE you open the Rearvy app

### 3. Load the Blender MCP addon
- In Blender: `Edit → Preferences → Add-ons`
- Search for "MCP" or "Blender MCP"
- Enable the addon
- Restart Blender if needed

## Quick Start

### Windows Desktop Dev
```batch
# From project root
1. Start Blender (ensure MCP addon is running)
2. Run: desktop-dev.bat
3. In Rearvy chat: "create a ball" or similar Blender command
```

### Set Environment Variable (Optional)
If `blender-mcp` is in a custom location:
```powershell
$env:BLENDER_MCP_CMD = "C:\path\to\blender-mcp"
npm run dev:desktop
```

Or via `.env.local` in desktop-app/:
```
BLENDER_MCP_CMD=C:\path\to\blender-mcp
```

## Troubleshooting

### Error: "EADDRINUSE: address already in use :::3002"
**Fix:** Port 3002 is still in use from a previous Electron process.
```powershell
# Kill all Node/Electron processes
taskkill /IM node.exe /F
taskkill /IM electron.exe /F
# Then restart
npm run dev:desktop
```

### Error: "Could not connect to Blender / Make sure the Blender addon is running"
**Causes & Fixes:**
- [ ] Blender is not running → Launch Blender first
- [ ] MCP addon is not loaded → Enable it in Preferences
- [ ] `blender-mcp` is not installed → Run `pip install blender-mcp`
- [ ] `blender-mcp` is not in PATH → Set `BLENDER_MCP_CMD` env var

### Error: "Failed to start blender-mcp with command uvx"
**Fix:** Install `uv` package manager:
```powershell
pip install uv
```

Or use explicit command:
```powershell
$env:BLENDER_MCP_CMD = "python -m blender_mcp"
npm run dev:desktop
```

## Architecture
```
Rearvy App (Electron)
    ↓
Blender MCP Bridge (port 3002)
    ↓
Blender MCP Server (stdio/SSE)
    ↓
Blender (with MCP addon loaded)
```

## Verification
Check bridge health:
```powershell
# In PowerShell, while app is running
$response = Invoke-WebRequest -Uri "http://localhost:3002/health"
$response.Content | ConvertFrom-Json
# Should return: { "status": "ok", "connected": true }
```

## Next Steps
1. **Verify prerequisites are met** (Blender running, addon loaded, `blender-mcp` installed)
2. **Start the app**: `npm run dev:desktop`
3. **Test in chat**: Ask "create a ball" or similar
4. **Check console** for detailed error messages if it fails

---
For more details, see:
- [DESKTOP_AGENT_GUIDE.md](DESKTOP_AGENT_GUIDE.md)
- [scripts/blender-mcp-bridge.mjs](scripts/blender-mcp-bridge.mjs)
- [desktop-app/main.cjs](desktop-app/main.cjs)
