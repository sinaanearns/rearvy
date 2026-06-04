# Desktop Agent Guide: Using MCP Tools with Rearvy AI

## Overview

When running **Rearvy in Desktop Mode** (`npm run dev:desktop`), the AI gets access to **Model Context Protocol (MCP) tools** that can directly interact with your local system. This is different from the web app, which can only browse and show guides.

## Quick Start

### Running Desktop Mode
```powershell
npm run dev:desktop
```

This:
1. Starts the Next.js dev server (localhost:3000)
2. Launches the Electron app
3. Initializes the Blender MCP bridge
4. Tells the AI: "You have Blender tools available"

### Using Blender from AI
In the Rearvy chat, you can now ask:
- "Create a ball in Blender"
- "Make a cylinder and scale it"
- "Render a simple cube and save the output"

The AI will **execute these commands directly** via the Blender MCP, not just show you a guide.

## How It Works

### 1. Environment Detection

```
Desktop App (Electron)
├─ User-Agent includes "electron"
├─ NODE_ENV = "development"
└─ Detected by: src/app/api/chat/route.ts line 767

                 ↓

Chat Route
├─ Sets isDesktopApp = true
├─ Passes flag to tool registry
└─ Passes flag to system prompt

                 ↓

MCP Hub (src/lib/ai/mcp/hub.ts)
├─ Checks: NODE_ENV === "development" || isDesktopApp
├─ Gate passes ✅ (because isDesktopApp = true)
├─ Loads stdio MCP servers (Blender, local tools)
└─ Returns tools to AI

                 ↓

System Prompt
├─ Sees isDesktopApp = true
├─ Includes: "[Desktop Mode] You have access to Blender MCP tools"
└─ AI is instructed to use them
```

### 2. MCP Server Loading

When the desktop app starts:

1. **Blender MCP Bridge** spawns
   - Location: `scripts/blender-mcp-bridge.mjs`
   - Started by: `desktop-app/main.cjs` line ~408
   - Communicates with Blender via stdio

2. **Firestore MCP Config** loads
   - Location: `src/lib/firebase/schema.ts` → `COLLECTIONS.MCP_SERVERS`
   - Contains: Server name, command, args, environment
   - Example: `{ name: "blender-mcp", type: "stdio", command: "uvx blender-mcp", ... }`

3. **AI Gets Tools**
   - Each MCP server exposes tools
   - Tools get prefixed: `mcp_blender_<toolname>`
   - AI registry lists all available tools
   - System prompt includes them in available context

### 3. Logging & Debugging

**To see MCP loading in action**, check browser DevTools Console (F12):

```
[MCP] Loading stdio server 'blender-mcp' in desktop environment
[MCP] Connected to 'blender-mcp', loaded 5 tools
[MCP] Hub initialization complete: 5 total MCP tools available for desktop mode
```

**If Blender MCP is skipped:**
```
[MCP] Skipping stdio server 'blender-mcp': NODE_ENV=production, isDesktopApp=false. 
Stdio servers only work in development or desktop mode.
```

This tells you immediately why the tool isn't available.

## Architecture

### Desktop Mode (npm run dev:desktop)
```
┌─────────────────────────────────────┐
│    Electron Desktop App             │
│ ┌─────────────────────────────────┐ │
│ │   Next.js Dev Server (port 3000)│ │
│ │   NODE_ENV=development          │ │
│ │   Blender MCP Bridge Started    │ │
│ │                                 │ │
│ │   Chat API                      │ │
│ │   ├─ isDesktopApp = true        │ │
│ │   ├─ Loads stdio MCP (Blender) │ │
│ │   ├─ System prompt includes      │ │
│ │   │   "[Desktop Mode] Blender   │ │
│ │   │    tools available"          │ │
│ │   └─ AI executes tasks          │ │
│ └─────────────────────────────────┘ │
│                                     │
│   MCP Hub                           │
│   ├─ stdio: Blender MCP            │
│   ├─ SSE: Cloud tools (future)     │
│   └─ Returns: Blender tools        │
│                                     │
│   Electron Bridge                   │
│   └─ Sends tool outputs to UI      │
└─────────────────────────────────────┘
```

### Web Mode (npm run dev:web)
```
┌─────────────────────────────────────┐
│    Next.js Website (Vercel)         │
│ NODE_ENV=production                 │
│ User-Agent ≠ "electron"             │
│                                     │
│ Chat API                            │
│ ├─ isDesktopApp = false             │
│ ├─ Skips stdio MCP (Blender)        │ ← NOT AVAILABLE
│ ├─ System prompt includes:          │
│ │   "[Web Mode] Blender requires    │
│ │    desktop app"                   │
│ └─ AI shows guides instead          │
│                                     │
│ MCP Hub                             │
│ ├─ stdio: ❌ BLOCKED                │
│ ├─ SSE: ✅ Cloud tools only         │
│ └─ Returns: Browser-use, etc.       │
└─────────────────────────────────────┘
```

## Available MCP Tools

### Work Platform Abilities and Pairing
Core Rearvy abilities are built in for every work agent, so chat tool access no
longer depends on a manual install screen. Stdio MCP tools remain desktop/dev
only; web mode can use SSE/cloud MCP tools when configured.

`/work/channels` can create a one-time pairing code for a desktop runtime. A
paired desktop device can poll `/api/work/pairing/jobs` for approved local jobs
such as browser sessions and desktop workflows, then report completion.

### Blender MCP (stdio - Desktop Only)
When the Blender MCP is loaded, the AI gets access to tools like:
- `mcp_blender_create_object` - Create 3D objects
- `mcp_blender_modify_object` - Edit objects
- `mcp_blender_render` - Render scenes

**Usage:**
```
User: "Create a cube and render it"
AI: Calls mcp_blender_create_object, then mcp_blender_render
Result: Actual Blender file created and rendered
```

### Other MCP Sources
- **Cloud Browser** (SSE) - Available in both modes
- **Trading APIs** (if configured)
- **Custom MCPs** - Any stdio server in Firestore config

## Troubleshooting

### "AI keeps showing Blender guides instead of executing"

**Problem:** You're running web mode or production.

**Solution:**
```powershell
# Wrong (web only):
npm run dev:web

# Correct (desktop with MCP):
npm run dev:desktop
```

### "MCP tools aren't loading"

**Check 1:** Are you in desktop mode?
```powershell
ps aux | grep electron  # Should show Electron running
```

**Check 2:** Check browser console (F12)
```
Look for: [MCP] Hub initialization complete
```

**Check 3:** Verify Firestore config
- Go to Firebase Console
- Check `MCP_SERVERS` collection
- Ensure `is_active: true` and `type: "stdio"`

### "Blender MCP Bridge failed to start"

**Check:** `desktop-app/main.cjs` logs
```
[Blender MCP] stderr: uvx command not found
```

**Solution:** Install `uv` package manager
```powershell
pip install uv
# Or: choco install uv (Windows)
```

## System Prompt Differences

### Desktop Mode System Prompt Includes:
```
[Desktop Mode] You have access to Blender MCP tools for 3D modeling 
and rendering. Use them for tasks like creating, modifying, or 
rendering 3D assets.
```

This tells the AI to **actively use** the tools.

### Web Mode System Prompt Includes:
```
[Web Mode] 3D modeling and Blender tasks require the Rearvy Desktop App. 
If the user asks for Blender work, explain they need the desktop app 
for that capability.
```

This tells the AI to **explain the limitation** and suggest desktop mode.

## MCP Configuration

### Where MCP Servers Are Defined

**Firestore:** `projects/{projectId}/mcp_servers/{docId}`
```json
{
  "name": "blender-mcp",
  "type": "stdio",
  "command": "uvx blender-mcp",
  "args": [],
  "env": {},
  "is_active": true,
  "user_id": "user@example.com"
}
```

**Code Locations:**
- Loading: `src/lib/ai/mcp/hub.ts` line 92
- Schema: `src/lib/firebase/schema.ts` → `McpServerConfig`
- Logging: See `[MCP]` prefixed messages in console

### Adding a Custom MCP

1. Define it in Firestore:
```javascript
db.collection('mcp_servers').add({
  name: 'my-tool',
  type: 'stdio',
  command: 'uvx my-tool-mcp',
  args: ['--flag', 'value'],
  env: { 'VAR': 'value' },
  is_active: true,
  user_id: currentUserId
})
```

2. Restart desktop app
3. Check console for: `[MCP] Connected to 'my-tool'`
4. AI can now use it

## Best Practices

### ✅ Do This
- Use desktop mode (`npm run dev:desktop`) when testing MCP features
- Check `[MCP]` console logs to verify tool loading
- Pass `isDesktopApp=true` context for environment-aware prompts
- Document which tasks require desktop (3D, local execution)

### ❌ Don't Do This
- Don't assume web mode has Blender access (it doesn't)
- Don't hardcode tool names (prefixed with `mcp_` dynamically)
- Don't skip the environment detection (check `isDesktopApp`)
- Don't run Blender MCP in production (only in development)

## References

- **MCP Protocol Docs**: https://modelcontextprotocol.io/
- **Blender MCP**: `scripts/blender-mcp-bridge.mjs`
- **Hub Implementation**: `src/lib/ai/mcp/hub.ts`
- **System Prompt**: `src/lib/ai/system-prompt.ts`
- **Chat Route**: `src/app/api/chat/route.ts` (line 767 for `isDesktopApp`)
- **Desktop App**: `desktop-app/main.cjs` (line 408 for Blender bridge)

## FAQ

### Q: Can I use Blender MCP on the website?
**A:** Not in production. In development, the website uses production mode which blocks stdio servers. Use desktop mode for Blender.

### Q: Why is stdio MCP blocked in production?
**A:** Stdio servers need local process spawning. Cloud/serverless environments can't do this. Use SSE-based MCPs for web instead.

### Q: How do I convert Blender MCP to work on the web?
**A:** Run a local HTTP bridge that exposes Blender via SSE. Set `type: "sse"` in Firestore config with `url: "http://localhost:8000"`. This is a future enhancement.

### Q: Can I use multiple MCPs at once?
**A:** Yes! The hub loads all active MCP servers from Firestore. Each tool is prefixed with the server name to avoid collisions.

### Q: What if the AI doesn't use the tool even though it's available?
**A:** Check the system prompt includes the tool in available context. The MCP tools are automatically added to the tool registry, but they must also be in the system prompt description for the AI to use them effectively.
