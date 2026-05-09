# Rearvy App ↔ Blender MCP Connection Fixes

## Problem
The Rearvy desktop app fails to connect to Blender while localhost/CLI commands work fine. This is because the app's internal Blender MCP bridge wasn't properly configured to:
1. Find and start the `blender-mcp` server
2. Pass environment variables correctly to child processes
3. Provide helpful error messages when things fail

## Solution Implemented

### 1. **Improved Bridge Environment Handling** 
**File**: [desktop-app/main.cjs](desktop-app/main.cjs#L371)

**What changed**: The bridge subprocess now receives proper PATH, PYTHONPATH, and config env vars:
```javascript
const bridgeEnv = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: "1",
  PATH: process.env.PATH,           // ← Preserve PATH for command lookup
  PYTHONPATH: process.env.PYTHONPATH || "",
  BLENDER_MCP_CMD: process.env.BLENDER_MCP_CMD,
  BLENDER_MCP_URL: process.env.BLENDER_MCP_URL,
};
```

**Impact**: Bridge can now find `blender-mcp` in PATH and can be overridden via env vars.

---

### 2. **Windows-Friendly blender-mcp Discovery**
**File**: [scripts/blender-mcp-bridge.mjs](scripts/blender-mcp-bridge.mjs#L62)

**What changed**: Added Python module support as first fallback (more reliable on Windows):
```javascript
const candidates = [
  process.env.BLENDER_MCP_CMD,
  isWindows ? "python" : null,      // ← Try python first on Windows
  isWindows ? "python3" : null,
  "uvx",
  "blender-mcp",
].filter(Boolean);
```

**Tried commands**:
- `$env:BLENDER_MCP_CMD` (if set)
- `python -m blender_mcp` (Windows)
- `python3 -m blender_mcp` (Windows)
- `uvx blender-mcp` (universal)
- `blender-mcp` (if in PATH)

**Impact**: On Windows, `python -m blender_mcp` is far more reliable than relying on PATH resolution.

---

### 3. **Better Error Messages**
**File**: [desktop-app/main.cjs](desktop-app/main.cjs#L415)

**What changed**: Added detection for `blender-mcp` installation issues with helpful instructions:
```javascript
const mcpNotFound = message.includes("Could not start blender-mcp") || /* ... */;
if (mcpNotFound && !blenderAddonWarningShown) {
  dialog.showMessageBox({
    title: "Blender MCP Not Found",
    detail: "Install blender-mcp using one of:\n • pip install blender-mcp\n ...",
  });
}
```

**Impact**: Users get clear instructions instead of cryptic error codes.

---

### 4. **Setup & Verification Guide**
**Files Created**:
- [BLENDER_APP_SETUP.md](BLENDER_APP_SETUP.md) — Complete setup instructions
- [verify-blender-setup.ps1](verify-blender-setup.ps1) — Automated verification script

## Quick Start

### Step 1: Verify Setup
```powershell
# From project root (PowerShell)
.\verify-blender-setup.ps1
```

This checks:
- ✓ Node.js installed
- ✓ `blender-mcp` installed
- ✓ Blender installed
- ✓ Port 3002 available
- ✓ Bridge script exists

### Step 2: Install blender-mcp (if needed)
```powershell
pip install blender-mcp
```

### Step 3: Open Blender & Enable MCP Addon
1. Launch Blender
2. Go: **Edit → Preferences → Add-ons**
3. Search: "MCP" or "blender"
4. ✓ Enable the **Blender MCP** addon
5. Restart Blender (recommended)

### Step 4: Start Rearvy Desktop
```powershell
# From project root
npm run dev:desktop

# Or use the batch file (cleans stale processes first)
.\desktop-dev.bat
```

### Step 5: Test in Chat
Ask: `"create a ball"` or `"edit selected object"`

---

## Troubleshooting

### ❌ "Could not start blender-mcp"
**Cause**: `blender-mcp` is not installed

**Fix**:
```powershell
pip install blender-mcp
# Then restart app
```

### ❌ "EADDRINUSE: address already in use :::3002"
**Cause**: Previous Electron/Node process still using port

**Fix**:
```powershell
taskkill /IM node.exe /F
taskkill /IM electron.exe /F
# Or use: .\desktop-dev.bat (does this automatically)
```

### ❌ "Could not connect to Blender"
**Cause**: Blender not running or MCP addon not enabled

**Fix**:
1. Launch Blender manually
2. Verify MCP addon is enabled in **Preferences → Add-ons**
3. Try again in app chat

### ✓ Bridge Health Check
```powershell
# While app is running, check in PowerShell:
$response = Invoke-WebRequest -Uri "http://localhost:3002/health"
$response.Content | ConvertFrom-Json
# Should show: { "status": "ok", "connected": true }
```

---

## Architecture (Now Fixed)

```
Rearvy Desktop App (Electron)
    │
    ├─ IPC Bridge to Main Process
    │
    ├─ Main Process spawns Bridge subprocess with proper env:
    │
    └─→ Blender MCP Bridge (port 3002)
        │
        ├─ PATH inherited → can find blender-mcp
        ├─ PYTHONPATH inherited
        ├─ Env vars passthrough (BLENDER_MCP_CMD, BLENDER_MCP_URL)
        │
        └─→ Blender MCP Server
            │
            ├─ Tries: $BLENDER_MCP_CMD
            ├─ Tries: python -m blender_mcp (Windows)
            ├─ Tries: uvx blender-mcp (universal)
            ├─ Tries: blender-mcp (if in PATH)
            │
            └─→ Blender Instance (with MCP addon active)
```

---

## Environment Variables (Optional)

If `blender-mcp` is not in standard location, use:

```powershell
# PowerShell (session)
$env:BLENDER_MCP_CMD = "C:\path\to\blender-mcp"
npm run dev:desktop

# Or PowerShell (persistent)
[System.Environment]::SetEnvironmentVariable("BLENDER_MCP_CMD", "C:\path\to\blender-mcp", "User")

# Or add to desktop-app/.env.local (if supported)
BLENDER_MCP_CMD=C:\path\to\blender-mcp
```

---

## Files Modified

1. **[desktop-app/main.cjs](desktop-app/main.cjs#L371)** — Environment passthrough + error handling
2. **[scripts/blender-mcp-bridge.mjs](scripts/blender-mcp-bridge.mjs#L62)** — Windows-friendly command discovery

## Files Created

1. **[BLENDER_APP_SETUP.md](BLENDER_APP_SETUP.md)** — User-facing setup guide
2. **[verify-blender-setup.ps1](verify-blender-setup.ps1)** — Automated diagnostics script
3. **[BLENDER_APP_FIXES.md](BLENDER_APP_FIXES.md)** — This file (implementation details)

---

## Next Steps

1. **Test**: Run verification script and follow setup steps
2. **Report**: If still failing, check bridge logs in app console:
   - Look for `[Blender MCP]` messages
   - Check `[Blender MCP Error]` for specific failures
3. **Iterate**: The bridge now provides much better diagnostics

---

**Created**: May 9, 2026  
**Status**: ✓ Ready for testing
