# 🚀 Unlock Full Rearvy Features

You're using Rearvy, but you're **not using its full power** yet. 

## What You're Missing

Right now, these features are **LIMITED or UNAVAILABLE**:

✗ MCP Terminal (run commands directly from Rearvy)  
✗ AI Terminal Agent (automate tasks)  
✗ Automation workflows  
✗ Device access (USB, serial ports, cameras, microphone)  
✗ Screen capture  
✗ Advanced integrations  

**Your app can do SO MUCH MORE.** Keep reading to unlock it.

---

## ⚡ How to Unlock Full Features

Rearvy has two modes:

### 🔴 Limited Mode (Current)
- Web-only features
- No terminal access
- No device integration

### 🟢 Full Mode (What You Want)
- Everything above, PLUS
- Terminal commands from within Rearvy
- AI automation via MCP
- Hardware device access
- Screen capture & automation

---

## How to Enable Full Features

### Step 1: Open Terminal
- **Windows**: Press `Win + R`, type `powershell`, press Enter
- **Mac**: Press `Cmd + Space`, type `terminal`, press Enter
- **Linux**: Open your terminal application

### Step 2: Run These Commands

Copy and paste these **3 commands**, one at a time:

```powershell
cd rearvy2.0
npm run install:all
npm run dev
```

**That's it.** The app will start with full features enabled.

---

## What Happens

When you run those commands:

1. **`cd rearvy2.0`** — Navigate to your Rearvy folder
2. **`npm run install:all`** — Installs all the backend services and dependencies (first time only, takes ~2-3 minutes)
3. **`npm run dev`** — Starts Rearvy with:
   - Website running on `http://localhost:3000`
   - Desktop app launching automatically
   - Local server on `127.0.0.1:4000` (hidden, works in background)
   - Terminal Agent ready to use
   - Device APIs enabled

---

## What You Can Now Do

### 🖥️ Terminal Agent
Run system commands directly from Rearvy:
- Check git status: `git status`
- Run scripts: `npm start`
- Execute shell commands: `ls`, `dir`, `powershell` commands
- Stop/manage processes
- Open external terminals

### 🤖 AI Automation
- Let AI run commands for you
- Automate workflows
- Chain multiple operations

### 🔌 Device Integration
- Connect USB devices
- Access serial ports (Arduino, sensors, etc.)
- Use microphone & camera
- Capture screenshots
- Record screen

### 🔧 Advanced Features
- Native app integrations
- Real-time data sync
- Background automation

---

## Troubleshooting

### "I'm running the commands but Terminal still says 'Connecting...'"

**Solution:**
1. Wait 10-15 seconds for the website to fully start
2. You'll see "Ready on localhost:3000" in the terminal
3. Then the desktop app opens automatically
4. Terminal Agent becomes available after both are ready

### "Port already in use error"

**Solution:** You may have an old Rearvy still running. Stop it:

```powershell
taskkill /F /IM node.exe
taskkill /F /IM Rearvy.exe
```

Then run `npm run dev` again.

### "npm command not found"

You don't have Node.js installed. Download it from [nodejs.org](https://nodejs.org), install it, close your terminal, and try again.

### "Missing dependencies"

Run:
```powershell
npm run install:all
```

---

## FAQ

**Q: Do I need to run this every time I use Rearvy?**  
A: Only the first time (or if you close the terminal). Once running, Rearvy stays active.

**Q: Will this use a lot of system resources?**  
A: No. It's a lightweight local server + Node.js dev server. Should use <500MB RAM.

**Q: Can I close the terminal while using Rearvy?**  
A: No, keep it open. Closing it will stop Rearvy.

**Q: Is this safe?**  
A: Yes. It's running on your local machine only. No data leaves your computer without your permission.

**Q: How do I stop Rearvy?**  
A: Press `Ctrl + C` in the terminal.

---

## Summary

| Feature | Without Setup | With Setup |
|---------|---|---|
| Basic web app | ✅ | ✅ |
| Terminal commands | ❌ | ✅ |
| AI automation | ❌ | ✅ |
| Device access | ❌ | ✅ |
| Screen capture | ❌ | ✅ |
| Integrations | ⚠️ Limited | ✅ Full |

---

## Ready?

Open your terminal and run:

```powershell
cd rearvy2.0
npm run install:all
npm run dev
```

**That's all. You're about to unlock the full power of Rearvy.** 🎉

---

**Questions?** Check the [Detailed Setup Guide](./TERMINAL_SERVER_STARTUP.md) for more technical details.
