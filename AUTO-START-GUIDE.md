# Rearvy Desktop - One-Click Auto Start

## 🚀 Super Simple Setup (First Time Only)

### Step 1: Create Desktop Shortcut (One-time)
In your project root, **double-click**:
```
CREATE-DESKTOP-SHORTCUT.bat
```

This creates a desktop icon called **"Rearvy Desktop"** that runs everything with one click.

---

## 🎯 Every Time You Want to Use Rearvy

### Option A: Click Desktop Icon ⭐ (Easiest)
1. Find **"Rearvy Desktop"** on your desktop
2. **Double-click** it
3. Everything starts automatically:
   - ✓ Clears old processes
   - ✓ Launches Blender
   - ✓ Starts dev server
   - ✓ App opens at http://localhost:3000

### Option B: Manual Command
```powershell
cd C:\Users\sinaa\rearvy2.0
.\START-REARVY.bat
```

### Option C: Original Dev Command
```powershell
npm run dev:desktop
```

---

## What Happens When You Click

```
Double-click Shortcut
        ↓
Kills stale Node/Electron processes
        ↓
Checks dependencies (npm, Python)
        ↓
Launches Blender automatically
        ↓
Starts development server
        ↓
App opens in browser at http://localhost:3000
        ↓
Keep the terminal open or close it - app keeps running
```

---

## First Time Tips

1. **After clicking the shortcut**, wait ~10 seconds for everything to start
2. **Blender will launch** - enable the MCP addon when prompted
3. **Browser will open** to http://localhost:3000 - you're in Rearvy!
4. In chat, ask: `"create a ball"` to test Blender integration

---

## The Terminal Window

When you click the shortcut, a terminal opens showing debug info. You can:
- **Keep it open** - to see debug messages
- **Close it anytime** - the app keeps running in the background

---

## Files Explained

| File | Purpose |
|------|---------|
| `START-REARVY.bat` | Main auto-start script (double-click to run) |
| `CREATE-DESKTOP-SHORTCUT.bat` | Creates desktop icon (run once) |
| `desktop-dev.bat` | Old version (still works, but use START-REARVY.bat) |

---

## Troubleshooting One-Click Start

### ❌ Shortcut won't work / "File not found"
**Fix**: Run `CREATE-DESKTOP-SHORTCUT.bat` again

### ❌ App starts but nothing happens  
**Fix**: Look at terminal window - it shows errors
- Missing npm → Install Node.js
- Missing Python → Install Python

### ❌ Blender doesn't auto-launch
**Fix**: Open Blender manually - app still works if Blender is already running

### ❌ Want to add shortcut to Windows Start Menu
**Fix**: Copy the shortcut to:
```
C:\Users\[YourUsername]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs
```

---

## Pro Tips

- **Pin to Start**: Right-click shortcut → Pin to Start
- **Pin to Taskbar**: Right-click shortcut → Pin to taskbar  
- **Run as Admin**: Right-click shortcut → Properties → Advanced → Check "Run as admin"
- **Change Icon**: Right-click shortcut → Properties → Change Icon

---

**That's it!** Just double-click **"Rearvy Desktop"** and everything starts automatically. 🎉
