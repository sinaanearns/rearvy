# Rearvy Blender App — Now Fully Automatic! ✓

## Quick Start (Super Simple)

### 1️⃣ Run the app
```powershell
npm run dev:desktop
```

### 2️⃣ Enable Blender MCP addon
When Rearvy starts, **Blender launches automatically** and you see an info dialog.

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
**Now**: Run app → It launches Blender for you → Just enable addon  

---

## How It Works

```
npm run dev:desktop
    ↓
✓ Auto-detects Blender installation
✓ Launches Blender if not running
✓ Shows you addon enable instructions
✓ Starts the MCP bridge
✓ Ready for 3D editing!
```

---

## Need Help?

- **Setup details**: See [BLENDER_APP_SETUP.md](BLENDER_APP_SETUP.md)
- **Troubleshooting**: See [BLENDER_APP_FIXES.md](BLENDER_APP_FIXES.md)
- **Verify setup**: `.\verify-blender-setup.ps1`

---

**Status**: ✓ Fully automatic
