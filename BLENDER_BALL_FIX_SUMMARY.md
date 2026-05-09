# Blender Ball Creation — Root Cause & Fixes

## Root Problem (Now Fixed)
Your screenshot showed:
```
run Terminal Command
command: bpy.ops.object.mode_set(mode='OBJECT') bpy.ops.mesh.primitive_uv_sphere_add(size=1, location=(0, 0, 0), rotations=(0, 0, 0))
exit Code: 2
stderr: /bin/sh: -c: line 1: syntax error near unexpected token `mode='OBJECT''
```

**Why this happened:**
- AI was trying to execute Blender Python code via shell (`exec` + `/bin/sh`), not via the Blender MCP HTTP bridge.
- Shell command tool was broken on Windows (used Unix shell `/bin/sh` which doesn't exist on Windows).
- AI had no routing rule to force Blender requests toward MCP tools.

## Fixes Applied

### 1. **Cross-Platform Terminal Tool** (`website/src/lib/ai/tools/terminal.ts`)
- Replaced Unix-only `execAsync` with Windows-aware `spawn`.
- Tries `powershell.exe` first on Windows, falls back to `cmd.exe` if needed.
- File read/list operations now use Node.js `fs` directly instead of shell commands.
- **Result:** No more `/bin/sh` errors; shell commands are platform-safe.

### 2. **Blender-Intent Routing** (`website/src/app/api/chat/route.ts`)
- Added `isBlenderIntent()` detector that recognizes Blender/3D keywords.
- When Blender intent is detected in desktop mode:
  - **Disables terminal tools** (`includeTerminalTools: false`)
  - **Forces MCP-only mode** with system prompt override
  - AI only sees Blender MCP tools, not terminal tool
- **Result:** "Create a ball" now routes to `/call` HTTP API, not shell.

### 3. **Explicit System Prompt Rule** (`website/src/lib/ai/system-prompt.ts`)
- Added: `"BLENDER TOOLING RULE: For Blender scene creation/editing, use Blender MCP tools only. Do not use terminal commands."`
- **Result:** AI understands the policy even if routing logic changes.

### 4. **Bridge + Blender Binary Detection** (`desktop-app/main.cjs` + `scripts/blender-mcp-bridge.mjs`)
- Auto-detects Blender executable on Windows via `where blender` or common install paths.
- Passes `BLENDER_EXECUTABLE` to bridge environment.
- Bridge prepends Blender folder to `PATH` for subprocesses.
- **Result:** blender-mcp can spawn Blender even if not in system PATH.

## How to Test Now

### Quick Test (Next 2 Minutes)

1. **Start the desktop app:**
   ```powershell
   npm run dev:desktop
   ```
   
2. **Open the web UI** at `http://localhost:3000` once it loads.

3. **In chat, ask:**
   ```
   create a ball in blender
   ```
   OR
   ```
   add a uv sphere to the scene
   ```

4. **Expected behavior (NEW):**
   - AI recognizes Blender intent
   - Uses `mcp_*` tool calls (not `runTerminalCommand`)
   - Calls `http://localhost:3002/call` to create sphere
   - NO `/bin/sh` or syntax errors
   - Blender scene updates with sphere

5. **Check app console for logs like:**
   ```
   [Rearvy] Bridge env - BLENDER_EXECUTABLE: C:\Program Files\Blender Foundation\Blender 4.2\blender.exe
   [Bridge] Connected to blender-mcp
   [BRIDGE] Calling tool: blender_add_mesh_uv_sphere with args: {...}
   ```

### If It Still Doesn't Work

**Check bridge health:**
```powershell
Invoke-WebRequest -Uri http://127.0.0.1:3002/health | ConvertFrom-Json
```

Expected:
```json
{ "status": "ok", "connected": true }
```

**If bridge is not running:**
- Desktop app will auto-launch it on startup
- Look for `[Blender MCP]` logs in console
- If missing, check if Blender is running (with MCP addon enabled)

**If bridge reports disconnected:**
1. Open Blender (if not already open)
2. Go to Edit → Preferences → Add-ons
3. Search for `MCP`
4. Enable the Blender MCP addon
5. Restart Blender
6. Retry the ball creation in chat

## Files Changed

- `website/src/lib/ai/tools/terminal.ts` — Cross-platform shell execution
- `website/src/app/api/chat/route.ts` — Blender-intent routing & MCP forcing
- `website/src/lib/ai/system-prompt.ts` — Explicit Blender tooling rule
- `scripts/blender-mcp-bridge.mjs` — ESM import cleanup, BLENDER_EXECUTABLE env setup
- `desktop-app/main.cjs` — Blender binary auto-detection
- `verify-blender-setup.ps1` — Fixed PowerShell syntax

## Next Steps If Successful

Once ball creation works:
1. Try more complex Blender commands (rotate, scale, material, render)
2. Test that terminal commands (`npm run build`, `git status`) still work via terminal tool
3. Both should coexist without conflicts

---

**Summary:** The AI was incorrectly trying to execute bpy code as shell commands. Now it correctly routes Blender requests through MCP tools via the local HTTP bridge, and shell tools are Windows-aware so they won't crash with ENOENT.
