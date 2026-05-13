# Rearvy Blender App — Opt-In Blender Mode

## Quick Start (Super Simple)

### 1️⃣ Run the app in normal mode
```powershell
npm run dev:desktop
```

### 2️⃣ Use Blender mode only when needed
Normal desktop startup does **not** launch Blender anymore.

If you want Blender tools, start the explicit Blender mode instead:
```powershell
npm run desktop:dev:blender
```

Or set the opt-in flag before launching the desktop app:
```powershell
$env:REARVY_ENABLE_BLENDER = "1"
npm run dev:desktop
```

In Blender, follow the 4 steps:
1. **Edit → Preferences → Add-ons**
2. **Search**: "MCP"
3. **✓ Enable** the addon
4. **Done!** (Restart Blender optional)

### 3️⃣ Test in chat
Ask: `"create a ball"` or `"add a sphere"`

**That's it!** 🎉

---

## What Changed

**Before**: Manually open Blender → Enable addon → Run app  
**Now**: Run app normally, or use the explicit Blender mode when you need 3D tools  

---

## How It Works

```
npm run dev:desktop
    ↓
✓ Starts normally without Blender

npm run desktop:dev:blender
    ↓
✓ Starts the Blender MCP bridge
✓ Launches Blender if needed
✓ Shows you addon enable instructions
✓ Ready for 3D editing!
```

---

## Need Help?

- **Setup details**: See [BLENDER_APP_SETUP.md](BLENDER_APP_SETUP.md)
- **Troubleshooting**: See [BLENDER_APP_FIXES.md](BLENDER_APP_FIXES.md)
- **Verify setup**: `.\verify-blender-setup.ps1`

---

**Status**: Opt-in Blender support
