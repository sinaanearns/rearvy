# Rearvy Terminal & Server Startup Guide

This guide explains how to start the Rearvy server and terminal for local development.

## Project Structure

Rearvy is split into two independent applications:

- **`/website`** — React + Next.js frontend (runs on `http://localhost:3000`)
- **`/desktop-app`** — Electron desktop application (with local API server on `http://127.0.0.1:4000`)

## Prerequisites

Before starting, ensure you have:

- **Node.js** (v18+) and npm installed
- **Python** (optional, for certain scripts)
- All dependencies installed

### Install All Dependencies

From the repo root:

```bash
npm run install:all
```

This installs dependencies in:
- Root folder
- `website/` folder
- `desktop-app/` folder

## Starting the Server & Terminal

### Option 1: Start Both (Recommended)

Start the website dev server and desktop app together:

```bash
npm run dev:both
```

This will:
1. Start the website dev server on `http://localhost:3000`
2. Launch the Electron desktop app after the website is ready
3. Enable the Terminal Agent in the desktop app

### Option 2: Start Website Only

For browser-based development (no Terminal Agent):

```bash
npm run dev:web
```

Opens: `http://localhost:3000`

### Option 3: Start Desktop App Only

If the website dev server is already running:

```bash
npm run dev:desktop
```

This launches the Electron app, which will attempt to connect to `http://localhost:3000`.

### Option 4: Start Services Separately (Advanced)

**Terminal 1 — Website Dev Server:**

```bash
cd website
npm run dev
```

**Terminal 2 — Desktop App:**

```bash
cd desktop-app
npm run dev
```

## Terminal Agent Features

The **Terminal Agent** is only available in the Electron desktop app and requires:

1. ✅ Website dev server running (`http://localhost:3000`)
2. ✅ Desktop app launched (`npm run dev:desktop`)
3. ✅ Local API server running (starts automatically on port `4000`)

### Terminal Agent Capabilities

Once running, you can use the Terminal Agent to:

- Run commands: `npm run dev`, `git status`, `python script.py`, etc.
- Execute PowerShell (Windows) commands directly
- Stop running processes
- Open external terminals

### If Terminal Agent Shows "Connecting to Terminal..."

Try these steps:

1. **Ensure website is running:**
   ```bash
   npm run dev:web
   ```

2. **Restart desktop app:**
   - Close the Rearvy desktop window
   - Run: `npm run dev:desktop`

3. **Check port 4000 is not blocked:**
   ```bash
   # Windows
   netstat -ano | findstr :4000
   
   # macOS/Linux
   lsof -i :4000
   ```

4. **Open DevTools for debugging:**
   - Press `F12` in the desktop app
   - Check the Console for error messages

## Available npm Scripts

From repo root:

| Command | Purpose |
|---------|---------|
| `npm run dev:web` | Start website dev server |
| `npm run dev:desktop` | Start Electron desktop app |
| `npm run dev:both` | Start website + desktop together |
| `npm run build:web` | Build website for production |
| `npm run build:desktop` | Build desktop app |
| `npm run build` | Build both web and desktop |
| `npm install:all` | Install dependencies in all folders |
| `npm run lint` | Run ESLint checks |
| `npm run clean` | Remove Next.js build artifacts |

## Troubleshooting

### "Connecting to Terminal..." Stuck

**Issue:** Terminal Agent unable to connect to the desktop backend.

**Solutions:**
1. Check that the website dev server is running (`http://localhost:3000`)
2. Verify the local API server started (look for `✓ Local API started successfully on port 4000` in the desktop app logs)
3. Click "Retry Connection" button in the Terminal Agent UI
4. Reload the app: Press `Ctrl+R` (or `Cmd+R` on macOS)

### Port Already in Use

**Issue:** Port 3000 or 4000 is already in use.

**Solution:**
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Kill process on port 3000 (macOS/Linux)
lsof -i :3000
kill -9 <PID>
```

Then restart the dev server.

### npm install Fails

**Issue:** Dependency installation error.

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove lock files and node_modules
rm -rf node_modules package-lock.json
rm -rf website/node_modules website/package-lock.json
rm -rf desktop-app/node_modules desktop-app/package-lock.json

# Reinstall everything
npm run install:all
```

### Desktop App Won't Launch

**Issue:** Electron fails to start.

**Solution:**
1. Ensure dependencies are rebuilt:
   ```bash
   cd desktop-app
   npx electron-rebuild -f -w serialport
   ```

2. Check for port conflicts (especially port 4000 for local API)
3. Try deleting Electron cache and restarting:
   ```bash
   rm -rf ~/.config/Electron  # Linux
   rm -rf ~/Library/Application\ Support/Electron  # macOS
   rmdir %APPDATA%\Electron  # Windows
   ```

## Development Workflow

### Hot Reload

- **Website:** Changes to React/Next.js code auto-reload in the browser
- **Desktop App:** Changes to `main.cjs`/`preload.cjs` require restarting the Electron app
- **Terminal Service:** Changes require restarting the desktop app

### Debugging

**Website:**
- Open browser DevTools: `F12` or `Ctrl+Shift+I`
- Use React DevTools browser extension

**Desktop App:**
- Open Electron DevTools: `F12` in the app window
- Check main process logs in the terminal where you ran `npm run dev:desktop`

## Next Steps

1. Start with: `npm run dev:both`
2. Navigate to the **Terminal** section in the left sidebar
3. Try running a command like: `npm run lint`
4. Monitor output in the Terminal Agent panel

---

**Questions or issues?** Check the console logs or raise an issue in the repository.
