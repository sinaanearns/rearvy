# Rearvy Separated App & Website Structure

This repository has been reorganized to separate the **website** and **desktop app** into independent projects with their own dependencies, build processes, and development servers.

## 📁 Project Structure

```
rearvy2.0/
├── website/                 # Next.js web application
│   ├── package.json        # Website dependencies
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   └── src/               # Website source code
│
├── desktop-app/           # Electron desktop application
│   ├── package.json       # Desktop dependencies
│   ├── main.cjs           # Electron main process
│   ├── preload.cjs        # Electron preload script
│   └── [source files]
│
├── package.json           # Root meta package (scripts only)
├── public/                # Shared assets (favicon, images)
├── scripts/               # Shared utility scripts
└── [config files]         # Shared configs (eslint, etc)
```

## 🚀 Quick Start

### Option 1: Run Website Only
```bash
npm run dev:web
```
- Runs on `http://localhost:3000`
- Website has its own `next.config.ts`, `tsconfig.json`, etc.
- Independent from desktop app

### Option 2: Run Desktop App Only
```bash
npm run dev:desktop
```
- Launches Electron desktop app
- Connects to `http://localhost:3001` (configurable)
- Independent from website

### Option 3: Run Both (Website + App)
```bash
npm run dev:both
```
- Starts website on port 3000
- Waits for website to start, then launches Electron
- Electron connects to running website

## 📦 Installation

### Install All Dependencies
```bash
npm run install:all
```

This command:
1. Installs root dependencies (concurrently, wait-on, eslint)
2. Installs website dependencies (`cd website && npm install`)
3. Installs desktop app dependencies (`cd desktop-app && npm install`)

### Or Install Individually
```bash
npm install                    # Root
cd website && npm install      # Website
cd desktop-app && npm install  # Desktop app
```

## 🔧 Environment Variables

Each app can have its own `.env.local`:

**Website**: `website/.env.local`
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

**Desktop App**: `desktop-app/.env.local`
```
REARVY_DESKTOP_UI_ORIGIN=http://localhost:3001
REARVY_DESKTOP_DEV_URL=http://localhost:3001
REARVY_DESKTOP_APP_URL=https://api.rearvy.com
```

`REARVY_DESKTOP_UI_ORIGIN` controls where desktop auth callbacks send users after Shopify/GitHub OAuth. Use an `http://` or `https://` origin only.

Root: `.env.local` (optional, for shared scripts)

## 🛠️ Build Commands

### Build Website Only
```bash
npm run build:web
```

### Build Desktop App Only
```bash
npm run build:desktop
```

### Build Both
```bash
npm run build
```

### Build Windows Installer
```bash
cd desktop-app && npm run build:win
```

## 🏃 Runtime Scripts

### Website
```bash
cd website && npm run dev      # Development
cd website && npm run build    # Production build
cd website && npm run start    # Run production build
cd website && npm run lint     # Lint code
```

### Desktop App
```bash
cd desktop-app && npm run dev          # Development
cd desktop-app && npm run dev:wait     # Dev with server wait
cd desktop-app && npm run build        # Build installer
cd desktop-app && npm run build:win    # Windows build
```

### Root
```bash
npm run lint              # Lint both projects
npm run install:all       # Install all dependencies
npm run dev:web          # Website only
npm run dev:desktop      # Desktop app only
npm run dev:both         # Both
npm run build            # Build both
npm run build:web        # Build website
npm run build:desktop    # Build desktop app
```

## 🔌 Key Differences

| Aspect | Website | Desktop App |
|--------|---------|------------|
| **Port** | 3000 | N/A (Electron) |
| **DevURL** | `localhost:3000` | `localhost:3001` (configurable) |
| **Framework** | Next.js 16 | Electron 41 |
| **Entry** | `website/src/app` | `desktop-app/main.cjs` |
| **Output** | `.next/` | Electron executable |
| **Config** | `website/next.config.ts` | `desktop-app/package.json` |

## 📝 Dependencies

### Root Only
- `concurrently` - Run multiple commands
- `wait-on` - Wait for port availability
- `eslint` - Linting (optional, each app has own)

### Website (`website/package.json`)
- Next.js 16, React 19
- Firebase (client)
- Tailwind CSS, Radix UI
- AI SDK (Vercel)

### Desktop App (`desktop-app/package.json`)
- Electron 41
- Firebase (client)
- React 19 (for potential Electron UI)
- Minimal dependencies for performance

## 🔗 Shared Resources

Both apps can access:
- `public/` - Shared assets (favicon, images)
- `scripts/` - Shared utility scripts
- Root `.env.local` (optional)

## ❌ Troubleshooting

### `npm run dev:web` fails
```bash
cd website && npm install
npm run dev:web
```

### `npm run dev:desktop` fails
```bash
cd desktop-app && npm install
npm run dev:desktop
```

### Port already in use
Change port for website:
```bash
cd website && PORT=3001 npm run dev
```

### Desktop app can't connect to website
Ensure website is running on the correct port:
```bash
npm run dev:web  # Start website first
npm run dev:desktop  # Then start app
```

## 📚 Documentation

- Website: See `website/README.md` (if exists)
- Desktop: See `desktop-app/README.md` (if exists)
- Root: This file + `AGENTS.md`

## 🚢 Deployment

**Website**: Deploy `website/.next/` to Vercel or similar
**Desktop**: Build installers using `npm run build:desktop` in `desktop-app/`

---

**Note**: This separation allows each app to:
- Have independent build processes
- Avoid conflicts between Next.js and Electron tooling
- Scale dependencies independently
- Deploy/update separately
