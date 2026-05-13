# Rearvy Setup for Users

## First Run - Windows Security Warning

When you first launch Rearvy, you may see a Windows Defender SmartScreen warning:

```
"Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting"
```

**This is normal and safe.** Click **"Run anyway"** to proceed.

---

## Remove the Warning Permanently

To skip the warning on future runs, **run this one-time setup script**:

### Option 1: Batch Script (Easiest)
1. Right-click **`setup-windows-defender.bat`**
2. Select **"Run as administrator"**
3. Done! No more warnings.

### Option 2: PowerShell Script
Open PowerShell **as Administrator** and run:

```powershell
Add-MpPreference -ExclusionPath "C:\Program Files\Rearvy"
```

Then restart Rearvy.

---

## Troubleshooting

**Q: The SmartScreen warning still appears after setup**
- A: Restart your computer and try again

**Q: "Run as administrator" doesn't work**
- A: You may need Windows administrator privileges. Contact your system administrator.

**Q: I don't want to run a setup script**
- A: Just click "Run anyway" on the SmartScreen warning each time (takes 2 seconds)

---

## Need Help?

If you have issues:
1. Make sure you're running Rearvy from the Start Menu or desktop shortcut
2. If Windows Defender exclusion didn't work, contact support

---

**That's it!** Rearvy is now set up and ready to use. 🎉
