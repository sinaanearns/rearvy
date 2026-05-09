# Rearvy Blender App Connection — Action Plan

## What Was Fixed
The Rearvy desktop app couldn't connect to Blender, even though localhost worked. Root cause: **The Blender MCP bridge wasn't properly configured to find and run the `blender-mcp` server**.

## Changes Made ✓

### 1. **Environment Variables** — `desktop-app/main.cjs` 
- [x] Bridge now receives proper PATH, PYTHONPATH from parent process
- [x] Custom `BLENDER_MCP_CMD` and `BLENDER_MCP_URL` env vars are passed through
- [x] Logging added to show what's being passed

### 2. **Windows Support** — `scripts/blender-mcp-bridge.mjs`
- [x] Added `python -m blender_mcp` as first fallback (more reliable on Windows)
- [x] Tries: env var → python → python3 → uvx → blender-mcp
- [x] Better error messages with installation hints

### 3. **Error Handling** — `desktop-app/main.cjs`
- [x] Detects "blender-mcp not found" vs "Blender not running"
- [x] Shows users specific instructions for each failure type

### 4. **Documentation** — New guides
- [x] [BLENDER_APP_SETUP.md](../BLENDER_APP_SETUP.md) — Step-by-step setup
- [x] [BLENDER_APP_FIXES.md](../BLENDER_APP_FIXES.md) — Technical details
- [x] [verify-blender-setup.ps1](../verify-blender-setup.ps1) — Diagnostic script

---

## Now What? (Your Action Steps)

### ✓ Step 1: Verify Setup (PowerShell)
```powershell
cd C:\Users\sinaa\rearvy2.0
.\verify-blender-setup.ps1
```

This checks:
- Node/npm installed
- `blender-mcp` installed
- Blender installed
- Port 3002 available
- Bridge script present

**Expected output**: All ✓ checks passed

---

### ✓ Step 2: Install blender-mcp (if needed)
```powershell
pip install blender-mcp
```

Then verify again:
```powershell
.\verify-blender-setup.ps1
```

---

### ✓ Step 3: Launch Blender & Enable Addon
1. **Open Blender** (any version)
2. Go to: **Edit → Preferences → Add-ons**
3. Search for: **"MCP"** or **"blender"**
4. ✓ **Enable** the Blender MCP addon
5. Optionally restart Blender (recommended)

> **Keep Blender running** — The app needs it to be open with the addon active

---

### ✓ Step 4: Start Rearvy Desktop
```powershell
# Option A: Direct (uses npm)
npm run dev:desktop

# Option B: Batch file (cleans stale processes first) — RECOMMENDED
.\desktop-dev.bat
```

Watch the console for:
- `✓ [Blender MCP] Connected...` — Success! ✓
- `✗ [Blender MCP Error]` — Something's wrong, see next section

---

### ✓ Step 5: Test in Chat
In Rearvy chat, ask:
- `"create a ball"`
- `"edit selected object"`
- `"add a sphere"`

Should work now! 🎉

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `"Could not start blender-mcp"` | Not installed | `pip install blender-mcp` |
| `"EADDRINUSE :::3002"` | Port in use | `taskkill /IM node.exe /F` or use `desktop-dev.bat` |
| `"Could not connect to Blender"` | Blender/addon not running | Launch Blender, enable addon, restart |
| `"Failed to connect to Blender"` | Network issue | Try `localhost` vs `127.0.0.1` in logs |

---

## Useful Commands

```powershell
# Clean stale Node processes
taskkill /IM node.exe /F
taskkill /IM electron.exe /F

# Check bridge health (while app is running)
$response = Invoke-WebRequest -Uri "http://localhost:3002/health"
$response.Content | ConvertFrom-Json

# Check what's using port 3002
netstat -ano | findstr :3002

# Set environment variable for this session
$env:BLENDER_MCP_CMD = "C:\path\to\blender-mcp"
npm run dev:desktop
```

---

## Architecture

```
You write in Rearvy chat: "create a ball"
          ↓
Rearvy App (Electron) sends request
          ↓
Blender MCP Bridge (port 3002) ← now has proper PATH
          ↓
Blender MCP Server (stdio) ← now finds python -m blender_mcp
          ↓
Blender 3D (with addon active)
          ↓
3D ball created! ✓
```

---

## Reference Files

**Modified**:
- [desktop-app/main.cjs](../desktop-app/main.cjs#L371) — Bridge spawn + error handling
- [scripts/blender-mcp-bridge.mjs](../scripts/blender-mcp-bridge.mjs#L62) — blender-mcp discovery

**Created**:
- [BLENDER_APP_SETUP.md](../BLENDER_APP_SETUP.md) — Setup guide
- [BLENDER_APP_FIXES.md](../BLENDER_APP_FIXES.md) — Technical details
- [verify-blender-setup.ps1](../verify-blender-setup.ps1) — Verification script

---

## Still Having Issues?

1. **Run verification script**: `.\verify-blender-setup.ps1`
2. **Check app console**: Look for `[Blender MCP]` messages
3. **Check bridge health**: `Invoke-WebRequest http://localhost:3002/health`
4. **Verify Blender addon**: Edit → Preferences → Add-ons → Search MCP (enabled?)
5. **Try desktop-dev.bat**: Cleans processes and restarts cleanly

---

**Last updated**: May 9, 2026  
**Status**: ✓ Ready to test
