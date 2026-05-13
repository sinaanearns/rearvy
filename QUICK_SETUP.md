# Quick Setup for MCP Terminal & Features

Use this when you need to set up Rearvy to use the Terminal, MCP services, or any features requiring npm commands.

## 3-Step Setup

```powershell
cd rearvy2.0
npm run install:all
npm run dev
```

That's it. The app will start with:
- Website on `http://localhost:3000`
- Desktop app launching automatically
- Local API on `127.0.0.1:4000`
- MCP Terminal ready to use

## What This Does

| Command | Does What |
|---------|-----------|
| `cd rearvy2.0` | Navigate to the project folder |
| `npm run install:all` | Install dependencies for root + website + desktop-app |
| `npm run dev` | Starts both website dev server and desktop app together |

## If You Need Only One

```powershell
npm run dev:web      # Website only (localhost:3000)
npm run dev:desktop  # Desktop app only
```

## Troubleshooting

**"Connecting to Terminal" stuck?**
- Make sure website is running first (shows "Ready on localhost:3000")
- Then desktop app starts automatically

**Port already in use?**
```powershell
netstat -ano | findstr :3000  # Find what's using port 3000
taskkill /PID <PID> /F         # Kill it
```

**Dependencies missing?**
```powershell
npm run install:all
```

---

That's all you need to know to get started! 🚀
