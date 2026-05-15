# Next Steps After Separation Setup

## ✅ What Was Done

Your Rearvy project is now separated into two independent applications:

```
✓ website/          → Next.js web app (npm run dev:web)
✓ desktop-app/      → Electron desktop (npm run dev:desktop)
✓ Root scripts      → Convenience commands to run both
```

## 📋 Step-by-Step Setup

### Step 1: Install Dependencies (One-time)
```powershell
npm run install:all
```
This installs all dependencies for both the website and desktop app.

**Or manually:**
```powershell
npm install
cd website && npm install
cd ../desktop-app && npm install
cd ..
```

### Step 2: Create Environment Files

**For Website** (`website/.env.local`):
```env
# Copy from root .env.local if you have Firebase config
# Add any website-specific variables
```

**For Desktop App** (`desktop-app/.env.local`):
```env
# Optional - for custom dev URL
REARVY_DESKTOP_DEV_URL=http://localhost:3000
```

### Step 3: Test Each App Independently

**Option A: Run Website Only**
```powershell
npm run dev:web
```
✅ Runs on `http://localhost:3000`

**Option B: Run Desktop Only**
```powershell
npm run dev:desktop
```
✅ Opens Electron app

**Option C: Run Both Together**
```powershell
npm run dev:both
```
✅ Website on 3000 → Electron starts and connects

## 🔗 Command Reference

| Command | What It Does |
|---------|------------|
| `npm run dev:web` | Start website only (port 3000) |
| `npm run dev:desktop` | Start desktop app only |
| `npm run dev:both` | Start website + desktop (recommended) |
| `npm run build:web` | Build website for production |
| `npm run build:desktop` | Build desktop installer |
| `npm run build` | Build both |
| `npm run install:all` | Install all dependencies |
| `npm run lint` | Lint all code |

## 🤖 AI Capabilities: Desktop vs Web Mode

### Desktop Mode (`npm run dev:desktop`)
The Electron desktop app has **full local capabilities**:
- ✅ **Blender MCP** - AI can directly execute Blender commands to create/modify 3D assets
- ✅ **Local processes** - AI can run scripts and system commands
- ✅ **MCP tools** - All stdio-based MCP servers (Blender, local tools) are available
- ✅ **File system access** - Full access to local files

**When to use:** You want AI to actually *execute* tasks like "create a ball in Blender" instead of just showing guides.

### Web Mode (`npm run dev:web`)
The website is optimized for cloud/production:
- ❌ **No Blender MCP** - Blender tasks show guides instead of executing
- ✅ **Browser automation** - AI can control browser tasks
- ✅ **Cloud tools** - Web-based integrations (browser-use, trading APIs, etc.)
- ✅ **No local dependencies** - Runs purely as a web app

**When to use:** Testing web-only features, or production deployments.

### How It Works
1. When you use `npm run dev:desktop`, the Electron app sets `isDesktopApp=true`
2. The system prompt tells AI: "You have Blender MCP available"
3. When you use `npm run dev:web`, only web tools are available
4. The system prompt tells AI: "Blender requires the desktop app"

**Recommendation:** Use `npm run dev:both` or `npm run dev:desktop` to get full capabilities while developing.

## 📂 Important Locations

**Website Source**: `website/src/`
**Website Config**: `website/next.config.ts`, `website/tsconfig.json`
**Website Package**: `website/package.json`

**Desktop Source**: `desktop-app/main.cjs`, `desktop-app/preload.cjs`
**Desktop Package**: `desktop-app/package.json`

**Shared Assets**: `public/` (favicon, images)
**Shared Scripts**: `scripts/` (trading, utilities)
**Root Scripts**: Package at root level for convenience

## ⚠️ Important Notes

1. **Old desktop folder still exists** - The original `desktop/` folder is still there. You can delete it once confirmed both apps work:
   ```powershell
   Remove-Item -Recurse desktop
   ```

2. **Each app has its own node_modules** - Don't delete `node_modules/` unless you want to reinstall everything

3. **Environment variables** - Each app looks for its own `.env.local`. The old root `.env.local` still works for shared things

4. **Electron dev URL** - Desktop app now opens the dedicated `/desktop` workspace by default (`http://localhost:3000/desktop`). Change in `desktop-app/main.cjs` if needed

## 🧪 Test the Setup

```powershell
# Test 1: Website only
npm run dev:web
# Open browser to http://localhost:3000
# Should see Rearvy website

# Test 2: Desktop only (in new terminal)
npm run dev:desktop
# Should see Electron app window

# Test 3: Both together (kill previous terminals first)
npm run dev:both
# Website starts on 3000, then Electron opens
```

## 🐛 If Something Breaks

**Website won't start:**
```powershell
cd website
Remove-Item -Recurse .next
npm install
npm run dev
```

**Desktop won't start:**
```powershell
cd desktop-app
npm install
npm run dev
```

**Port already in use:**
```powershell
# Find what's using port 3000
netstat -ano | findstr :3000
# Kill process: taskkill /PID <PID> /F

# Or use different port:
cd website
$env:PORT=3001
npm run dev
```

## 📝 Migration Checklist

- [ ] Run `npm run install:all` successfully
- [ ] `npm run dev:web` works (website on 3000)
- [ ] `npm run dev:desktop` works (Electron opens)
- [ ] `npm run dev:both` works (both start)
- [ ] Delete old `desktop/` folder when confident
- [ ] Update `.env` files for both apps
- [ ] Test builds: `npm run build:web` and `npm run build:desktop`

## 🚀 Next: Try It Out

**Recommended first command:**
```powershell
npm run dev:both
```

This starts the website and desktop app together, exactly how they should work.

---

**Questions?** Refer to:
- `SEPARATION_SETUP.md` - Detailed documentation
- `AGENTS.md` - Agent instructions updated
- Root `README.md` - General project info
