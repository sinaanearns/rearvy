/* eslint-disable @typescript-eslint/no-require-imports */
console.log("[Rearvy] Starting main process...");

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
  shell,
} = require("electron");
console.log("[Rearvy] Electron imports successful");

const path = require("node:path");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const { startLocalServer, stopLocalServer } = require("./local-server.cjs");
const { initializeAutomation, setupAutomationIPC, cleanupAutomation } = require("./automation-integration.cjs");

console.log("[Rearvy] All imports successful");

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("[Rearvy] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Rearvy] Unhandled rejection at:", promise, "reason:", reason);
});

const APP_ID = "com.rearvy.desktop";
const DEFAULT_DEV_URL = "http://localhost:3000";
const APP_PROTOCOL = "rearvy";
const APP_PROTOCOL_HOST = "app";
const DEFAULT_PACKAGED_APP_URL = `${APP_PROTOCOL}://${APP_PROTOCOL_HOST}/index.html`;
const DESKTOP_CONFIG_FILENAME = "claude_desktop_config.json";
const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function isSafeOpenExternalUrl(target) {
  try {
    const parsed = new URL(target);
    return parsed.protocol === "https:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

async function readDesktopConfig() {
  const configPath = path.join(app.getPath("home"), DESKTOP_CONFIG_FILENAME);

  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const servers = Array.isArray(parsed.mcp_servers)
      ? parsed.mcp_servers
      : Array.isArray(parsed.servers)
      ? parsed.servers
      : [];

    if (!servers.length) {
      return null;
    }

    return { mcp_servers: servers };
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to read desktop MCP config:", error);
    }
    return null;
  }
}

// Register custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("rearvy", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("rearvy");
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Handle deep link from second instance
      const url = commandLine.pop();
      if (url && url.startsWith("rearvy://")) {
        handleProtocolUrl(url);
      }
    }
  });
}

let mainWindow = null;
let pendingAuthCredential = null;
let pendingAuthToken = null;
let blenderMcpProcess = null;
let desktopRequestHeaderRegistered = false;
let blenderAddonWarningShown = false;
let blenderBridgePortWarningShown = false;
let updateIntervalHandle = null;
let updaterInitialized = false;
let localApiPort = null;
let updateState = {
  supported: false,
  checking: false,
  updateAvailable: false,
  downloading: false,
  downloaded: false,
  currentVersion: null,
  latestVersion: null,
  downloadPercent: null,
  lastCheckedAt: null,
  lastError: null,
};

function broadcastUpdateState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("desktop:update:state", updateState);
}

function broadcastLocalApiPort() {
  if (!mainWindow || mainWindow.isDestroyed() || localApiPort === null) {
    return;
  }

  mainWindow.webContents.send("desktop:local-api-port", localApiPort);
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch,
  };
  broadcastUpdateState();
}

async function checkForDesktopUpdates() {
  if (!updaterInitialized || !updateState.supported) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState({
      checking: false,
      downloading: false,
      lastCheckedAt: Date.now(),
      lastError: message,
    });
    return { ok: false, reason: message };
  }
}

async function downloadDesktopUpdate() {
  if (!updaterInitialized || !updateState.supported || !updateState.updateAvailable) {
    return { ok: false, reason: "no-update" };
  }

  try {
    setUpdateState({ downloading: true, lastError: null });
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState({ downloading: false, lastError: message });
    return { ok: false, reason: message };
  }
}

function initializeDesktopUpdater() {
  if (updaterInitialized) {
    return;
  }

  updaterInitialized = true;

  setUpdateState({
    supported: app.isPackaged,
    currentVersion: app.getVersion(),
  });

  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({
      checking: true,
      updateAvailable: false,
      downloading: false,
      downloaded: false,
      downloadPercent: null,
      lastError: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    setUpdateState({
      checking: false,
      updateAvailable: true,
      downloaded: false,
      latestVersion: info?.version || null,
      lastCheckedAt: Date.now(),
      lastError: null,
    });

    void downloadDesktopUpdate();
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState({
      checking: false,
      updateAvailable: false,
      downloading: false,
      downloaded: false,
      downloadPercent: null,
      latestVersion: null,
      lastCheckedAt: Date.now(),
      lastError: null,
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    setUpdateState({
      downloading: true,
      downloadPercent:
        typeof progressObj?.percent === "number"
          ? Math.max(0, Math.min(100, progressObj.percent))
          : null,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState({
      checking: false,
      updateAvailable: true,
      downloading: false,
      downloaded: true,
      downloadPercent: 100,
      latestVersion: info?.version || updateState.latestVersion,
      lastCheckedAt: Date.now(),
      lastError: null,
    });

    void dialog
      .showMessageBox({
        type: "info",
        title: "Update ready",
        message: "A Rearvy update has been downloaded.",
        detail: "Restart now to install the update.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    setUpdateState({
      checking: false,
      downloading: false,
      lastCheckedAt: Date.now(),
      lastError: message,
    });
  });

  void checkForDesktopUpdates();

  updateIntervalHandle = setInterval(() => {
    void checkForDesktopUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
}

function getAppUrl() {
  if (!app.isPackaged) {
    return (
      process.env.REARVY_DESKTOP_DEV_URL ||
      process.env.REARVY_DESKTOP_APP_URL ||
      DEFAULT_DEV_URL
    );
  }

  return process.env.REARVY_DESKTOP_APP_URL || DEFAULT_PACKAGED_APP_URL;
}

function isLocalAppUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === `${APP_PROTOCOL}:` ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function waitForUrl(url, timeout = 30000, interval = 500) {
  return new Promise((resolve) => {
    const { URL } = require("url");
    const parsed = new URL(url);
    const httpMod = parsed.protocol === "https:" ? require("https") : require("http");
    const port = parsed.port || (parsed.protocol === "https:" ? 443 : 80);
    const hostname = parsed.hostname;
    const path = parsed.pathname || "/";

    console.log(`[waitForUrl] Starting with hostname=${hostname}, port=${port}, path=${path}, timeout=${timeout}ms, interval=${interval}ms`);

    const start = Date.now();

    function tryOnce() {
      const elapsed = Date.now() - start;
      console.log(`[waitForUrl] Attempt at ${elapsed}ms`);

      const req = httpMod.request(
        { method: "HEAD", hostname, port, path, timeout: 3000 },
        (res) => {
          console.log(`[waitForUrl] Got response with status ${res.statusCode}`);
          res.resume();
          resolve(true);
        }
      );

      req.on("error", (err) => {
        console.log(`[waitForUrl] Error: ${err.message}`);
        if (Date.now() - start >= timeout) {
          console.log(`[waitForUrl] timeout exceeded after ${Date.now() - start}ms`);
          resolve(false);
        } else {
          console.log(`[waitForUrl] Retrying after ${interval}ms...`);
          setTimeout(tryOnce, interval);
        }
      });

      req.on("timeout", () => {
        console.log("[waitForUrl] Request timeout, destroying and retrying...");
        req.destroy();
        // Trigger error handler by re-checking the timeout
        if (Date.now() - start >= timeout) {
          console.log(`[waitForUrl] overall timeout exceeded`);
          resolve(false);
        } else {
          console.log(`[waitForUrl] Retrying after ${interval}ms...`);
          setTimeout(tryOnce, interval);
        }
      });

      req.end();
    }

    tryOnce();
  });
}

async function startLocalWebsiteRuntime(projectRoot) {
  const websiteRoot = path.join(projectRoot, "website");
  const productionBuildId = path.join(websiteRoot, ".next", "BUILD_ID");

  let commandArgs;
  let cwd;

  // In desktop dev mode, always run the website dev server so recent source
  // changes are reflected immediately and we don't accidentally boot stale
  // `next start` output from an older build.
  if (!app.isPackaged) {
    commandArgs = ["run", "dev:web"];
    cwd = projectRoot;
    console.log("[Rearvy] Desktop dev mode detected, starting website dev server with npm run dev:web...");
  } else {
    try {
      await fs.access(productionBuildId);
      commandArgs = ["run", "start"];
      cwd = websiteRoot;
      console.log("[Rearvy] Starting packaged website runtime with npm run start...");
    } catch {
      commandArgs = ["run", "dev:web"];
      cwd = projectRoot;
      console.log("[Rearvy] Starting website dev server with npm run dev:web...");
    }
  }

  try {
    const child = spawn("npm", commandArgs, {
      cwd,
      stdio: "ignore",
      shell: true,
      detached: true,
    });
    child.unref();
    return true;
  } catch (e) {
    console.error("Failed to start website runtime:", e);
    return false;
  }
}

async function autoLaunchBlender() {
  console.log("[Rearvy] Checking if Blender is running...");

  // Check if Blender is already running
  try {
    const tasklist = require("child_process").execSync("tasklist", { encoding: "utf8" });
    if (tasklist.includes("blender.exe")) {
      console.log("[Rearvy] Blender is already running ✓");
      return { launched: false, success: true };
    }
  } catch (e) {
    console.warn("[Rearvy] Could not check running processes:", e.message);
  }

  // Try common Blender installation paths on Windows
  const blenderPaths = [
    "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
    "C:\\Program Files (x86)\\Blender Foundation\\Blender 4.2\\blender.exe",
    path.join(process.env.USERPROFILE, "AppData\\Local\\Programs\\Blender Foundation\\Blender 4.2\\blender.exe"),
  ];

  for (const blenderPath of blenderPaths) {
    try {
      await fs.access(blenderPath);
      console.log(`[Rearvy] Launching Blender from: ${blenderPath}`);

      const child = spawn(blenderPath, [], {
        stdio: "ignore",
        detached: true,
        windowsHide: true,
      });
      child.unref();

      // Give Blender time to start
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("[Rearvy] Blender launched successfully ✓");
      return { launched: true, success: true };
    } catch (e) {
      // Continue to next path
    }
  }

  console.warn("[Rearvy] Could not auto-launch Blender. Please open Blender manually.");
  return { launched: false, success: false };
}

function startBlenderMcpBridge() {
  if (blenderMcpProcess) {
    console.log("[Rearvy] Blender MCP bridge already started");
    return;
  }

  console.log("[Rearvy] Starting Blender MCP bridge...");

  const projectRoot = path.join(__dirname, "..");
  const bridgeScript = path.join(projectRoot, "scripts", "blender-mcp-bridge.mjs");

  console.log(`[Rearvy] Bridge script path: ${bridgeScript}`);
  console.log(`[Rearvy] Project root: ${projectRoot}`);

  // Ensure NODE_PATH and Python paths are passed to bridge process
  const { execSync } = require("child_process");
  const fsSync = require("fs");

  const bridgeEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    // Preserve critical paths for subprocess
    PATH: process.env.PATH,
    PYTHONPATH: process.env.PYTHONPATH || "",
    // Allow override via env var
    BLENDER_MCP_CMD: process.env.BLENDER_MCP_CMD,
    BLENDER_MCP_URL: process.env.BLENDER_MCP_URL,
    // BLENDER_EXECUTABLE can be used by blender-mcp to launch Blender directly
    BLENDER_EXECUTABLE: process.env.BLENDER_EXECUTABLE,
  };

  // Auto-detect blender executable if not explicitly set
  if (!bridgeEnv.BLENDER_EXECUTABLE) {
    try {
      const finder = process.platform === "win32" ? "where blender" : "which blender";
      const out = execSync(finder, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .split(/\r?\n/)
        .find(Boolean);
      if (out) bridgeEnv.BLENDER_EXECUTABLE = out.trim();
    } catch (e) {
      // not found via system path
    }

    // Windows common installation fallback
    if (!bridgeEnv.BLENDER_EXECUTABLE && process.platform === "win32") {
      const candidates = [
        "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
        path.join(process.env.USERPROFILE || "", "AppData\\Local\\Programs\\Blender Foundation\\Blender 4.2\\blender.exe"),
      ];
      for (const p of candidates) {
        try {
          if (fsSync.existsSync(p)) {
            bridgeEnv.BLENDER_EXECUTABLE = p;
            break;
          }
        } catch {}
      }
    }
  }

  console.log(`[Rearvy] Bridge env - BLENDER_MCP_CMD: ${bridgeEnv.BLENDER_MCP_CMD || "(not set)"}`);
  console.log(`[Rearvy] Bridge env - BLENDER_MCP_URL: ${bridgeEnv.BLENDER_MCP_URL || "(not set)"}`);
  console.log(`[Rearvy] Bridge env - BLENDER_EXECUTABLE: ${bridgeEnv.BLENDER_EXECUTABLE || "(not set)"}`);

  console.log("[Rearvy] Spawning bridge process...");
  try {
    blenderMcpProcess = spawn(process.execPath, [bridgeScript, "--port", "3002"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: bridgeEnv,
      windowsHide: true,
    });
    console.log("[Rearvy] Bridge process spawned successfully");
  } catch (error) {
    console.error("[Rearvy] Failed to spawn bridge process:", error);
    blenderMcpProcess = null;
    return;
  }

  blenderMcpProcess.stdout?.on("data", (data) => {
    console.log(`[Blender MCP] ${data.toString().trim()}`);
  });

  blenderMcpProcess.stderr?.on("data", (data) => {
    const message = data.toString().trim();
    console.error(`[Blender MCP Error] ${message}`);

    const addonNotRunning =
      message.includes("Could not connect to Blender") ||
      message.includes("Make sure the Blender addon is running") ||
      message.includes("Failed to connect to Blender") ||
      message.includes("WinError 10061");

    if (addonNotRunning && !blenderAddonWarningShown) {
      blenderAddonWarningShown = true;
      dialog.showMessageBox({
        type: "warning",
        title: "Blender Connection Required",
        message: "Rearvy can reach Blender MCP, but Blender is not connected.",
        detail:
          "To edit 3D objects:\n" +
          "1. Open Blender\n" +
          "2. Enable the Blender MCP add-on (Edit → Preferences → Add-ons → Search 'MCP')\n" +
          "3. Restart Blender\n\n" +
          "Then retry your request in chat (for example: 'create a ball' or 'edit selected object').",
        buttons: ["OK"],
      });
    }

    const mcpNotFound =
      message.includes("Could not start blender-mcp") ||
      message.includes("All blender-mcp command candidates failed") ||
      message.includes("ENOENT") ||
      message.includes("not found") ||
      message.includes("not recognized");

    if (mcpNotFound && !blenderAddonWarningShown) {
      blenderAddonWarningShown = true;
      dialog.showMessageBox({
        type: "warning",
        title: "Blender MCP Not Found",
        message: "The Blender MCP server is not installed or not in PATH.",
        detail:
          "Install blender-mcp using one of:\n" +
          "  • pip install blender-mcp\n" +
          "  • Or set BLENDER_MCP_CMD environment variable\n\n" +
          "Then restart Rearvy Desktop.",
        buttons: ["OK"],
      });
    }

    const bridgePortInUse =
      message.includes("EADDRINUSE") || message.includes("address already in use");

    if (bridgePortInUse && !blenderBridgePortWarningShown) {
      blenderBridgePortWarningShown = true;
      dialog.showMessageBox({
        type: "warning",
        title: "Blender Bridge Port Busy",
        message: "Port 3002 is already in use, so the Blender bridge cannot start.",
        detail:
          "Close previous Rearvy/Electron/Node processes, then relaunch desktop mode.\n\n" +
          "On Windows you can use desktop-dev.bat from the project root to clean stale processes and restart.",
        buttons: ["OK"],
      });
    }
  });

  blenderMcpProcess.on("error", (error) => {
    console.error("[Blender MCP] Failed to start:", error);
    blenderMcpProcess = null;
  });

  blenderMcpProcess.on("exit", (code, signal) => {
    console.log(`[Blender MCP] Exited with code ${code}, signal ${signal}`);
    blenderMcpProcess = null;
  });

  console.log("[Rearvy] Bridge event listeners set up successfully");
}

function registerDesktopRequestHeaders() {
  if (desktopRequestHeaderRegistered) {
    return;
  }

  const { session } = require("electron");
  const desktopHeaderName = "x-rearvy-desktop";

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...(details.requestHeaders || {}) };

    try {
      const requestOrigin = new URL(details.url).origin;
      const appOrigin = new URL(getAppUrl()).origin;

      if (requestOrigin === appOrigin) {
        requestHeaders[desktopHeaderName] = "1";
      } else if (app.isPackaged) {
        requestHeaders[desktopHeaderName] = "1";
      }
    } catch {
      // Leave third-party requests untouched.
    }

    callback({ requestHeaders });
  });

  desktopRequestHeaderRegistered = true;
}

function stopBlenderMcpBridge() {
  if (!blenderMcpProcess) {
    return;
  }

  console.log("[Rearvy] Stopping Blender MCP bridge...");
  blenderMcpProcess.kill();
  blenderMcpProcess = null;
}

function buildAppRouteUrl(pathname, searchParams = {}) {
  const url = new URL(getAppUrl());
  url.pathname = pathname;
  url.search = "";

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function sendPendingAuthToRenderer() {
  if (!mainWindow) {
    return;
  }

  if (pendingAuthCredential) {
    mainWindow.webContents.send("auth-credential", pendingAuthCredential);
    pendingAuthCredential = null;
  }

  if (pendingAuthToken) {
    mainWindow.webContents.send("auth-token", pendingAuthToken);
    pendingAuthToken = null;
  }
}

function handleProtocolUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === "rearvy:") {
      if (parsedUrl.host === "auth-callback") {
        const idToken = parsedUrl.searchParams.get("id_token");
        const accessToken = parsedUrl.searchParams.get("access_token");
        const token = parsedUrl.searchParams.get("token");

        if (idToken || accessToken) {
          pendingAuthCredential = { idToken, accessToken };
          sendPendingAuthToRenderer();
        } else if (token) {
          pendingAuthToken = token;
          sendPendingAuthToRenderer();
        }
      }
    }
  } catch (e) {
    console.error("Failed to handle protocol URL:", e);
  }
}

function isTrustedPopupUrl(rawUrl, appUrl) {
  try {
    const parsed = new URL(rawUrl);
    const appOrigin = new URL(appUrl).origin;
    const host = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      if (parsed.protocol === `${APP_PROTOCOL}:`) {
        return parsed.hostname === APP_PROTOCOL_HOST || parsed.hostname === "auth-callback";
      }

      return false;
    }

    if (parsed.origin === appOrigin) {
      return true;
    }

    // Google URLs should be opened in external browser to avoid "Untrusted Browser" issues
    if (host === "accounts.google.com" || host.endsWith(".google.com")) {
      return false;
    }

    return (
      host === "rearvy.com" ||
      host === "www.rearvy.com" ||
      host === "rearvy-74c50.firebaseapp.com" ||
      host.endsWith(".firebaseapp.com") ||
      host === "github.com" ||
      host.endsWith(".github.com") ||
      host === "www.facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "www.instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "admin.shopify.com" ||
      host.endsWith(".myshopify.com") ||
      host === "login.microsoftonline.com" ||
      host.endsWith(".login.microsoftonline.com")
    );
  } catch {
    return false;
  }
}

function getPackagedWebsiteRoot() {
  return path.join(__dirname, "..", "website", "out");
}

function fsSyncExists(filePath) {
  try {
    const fsSync = require("fs");
    return fsSync.existsSync(filePath);
  } catch {
    return false;
  }
}

function resolvePackagedWebsiteFile(requestPath) {
  const websiteRoot = getPackagedWebsiteRoot();
  const decodedPath = decodeURIComponent(requestPath || "/");
  const trimmedPath = decodedPath.replace(/^\/+/, "");

  const candidatePaths = [];

  if (!trimmedPath) {
    candidatePaths.push(path.join(websiteRoot, "index.html"));
  } else {
    candidatePaths.push(path.join(websiteRoot, trimmedPath));
    candidatePaths.push(path.join(websiteRoot, `${trimmedPath}.html`));
    candidatePaths.push(path.join(websiteRoot, trimmedPath, "index.html"));
  }

  for (const candidatePath of candidatePaths) {
    if (fsSyncExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function registerRearvyProtocol() {
  protocol.registerFileProtocol(APP_PROTOCOL, (request, callback) => {
    try {
      const requestUrl = new URL(request.url);
      const resolvedPath = resolvePackagedWebsiteFile(requestUrl.pathname || "/");

      if (resolvedPath) {
        callback({ path: resolvedPath });
        return;
      }

      callback({ error: -6 });
    } catch (error) {
      console.error("[Rearvy] Failed to resolve local app URL:", error);
      callback({ error: -2 });
    }
  });
}

function createMainWindow() {
  console.log("[Rearvy] createMainWindow called");
  const appUrl = getAppUrl();
  console.log(`[Rearvy] App URL: ${appUrl}`);
  const iconPath = path.join(__dirname, "..", "..", "public", "favicon.svg");
  const preloadPath = path.join(__dirname, "preload.cjs");

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Rearvy",
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
      webviewTag: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    console.log("[Rearvy] ready-to-show event fired");
    mainWindow?.show();
    console.log("[Rearvy] Main window shown");
  });

  mainWindow.webContents.once("did-finish-load", async () => {
    console.log("[Rearvy] did-finish-load event fired");
    sendPendingAuthToRenderer();
    broadcastUpdateState();
    broadcastLocalApiPort();

    // Initialize automation
    initializeAutomation(mainWindow, "default-user", process.env.ANTHROPIC_API_KEY || "");

    const desktopConfig = await readDesktopConfig();
    if (desktopConfig) {
      mainWindow.webContents.send("desktop-mcp-config", desktopConfig);
    }
    console.log("[Rearvy] did-finish-load handler completed");
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedPopupUrl(url, appUrl)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          minWidth: 420,
          minHeight: 560,
          parent: mainWindow ?? undefined,
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: preloadPath,
            // Use a standard Chrome UA for popups to avoid "Untrusted Browser"
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        },
      };
    }

    // Open Google and other non-trusted URLs in the external system browser
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("mailto:") || url.startsWith("tel:")) {
      event.preventDefault();
      void shell.openExternal(url);
      return;
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      // Don't show error dialogs for iframe load failures (like blocked tracking pixels)
      if (isMainFrame === false) {
        return;
      }

      // Ignore common network aborts and frame blocking errors that shouldn't crash the app
      if (errorCode === -3 || errorCode === -27 || errorDescription === 'ERR_BLOCKED_BY_RESPONSE') {
        return;
      }

      dialog.showErrorBox(
        "Rearvy could not open",
        `Rearvy could not load ${validatedUrl || appUrl}.\n\n${errorDescription} (Code: ${errorCode})`
      );
    }
  );

  if (app.isPackaged) {
    const packagedRoot = getPackagedWebsiteRoot();

    if (!resolvePackagedWebsiteFile("/")) {
      dialog.showErrorBox(
        "Start failed",
        `Rearvy could not find the packaged website export at ${packagedRoot}. Rebuild the desktop app with the exported website output included.`
      );
      return;
    }

    void mainWindow.loadURL(appUrl);
    return;
  }

  // Before loading, ensure the app URL is reachable (helpful in dev when website isn't running)
  (async () => {
    try {
      console.log("[Rearvy] Async URL loader IIFE started");
      const projectRoot = path.join(__dirname, "..");
      console.log(`[Rearvy] Checking if localhost URL: ${appUrl}`);
      // For localhost URLs, skip the HTTP check (Electron has issues with it) and load directly
      const isLocal = isLocalAppUrl(appUrl);
      console.log(`[Rearvy] Is local URL: ${isLocal}`);
      const available = isLocal ? true : await waitForUrl(appUrl, 2000, 200);
      console.log(`[Rearvy] URL availability check returned: ${available}`);

      if (available) {
      console.log("[Rearvy] App URL is available, loading...");
      void mainWindow.loadURL(appUrl);
      console.log("[Rearvy] mainWindow.loadURL called");
      return;
      }

      if (!isLocalAppUrl(appUrl)) {
        dialog.showErrorBox(
          "Start failed",
          `Rearvy could not reach the configured app URL ${appUrl}. Set REARVY_DESKTOP_APP_URL to a reachable local or hosted URL.`
        );
        return;
      }

      // Auto-start the local website runtime if not running.
      console.log(`[Rearvy] App URL ${appUrl} not reachable, attempting to start local website runtime...`);
      const started = await startLocalWebsiteRuntime(projectRoot);
      if (!started) {
        dialog.showErrorBox("Start failed", "Could not launch the local website runtime. Please run 'npm run dev:web' in the project root or build the website and rerun the app.");
        return;
      }

      console.log("[Rearvy] Waiting for website to become ready...");
      const ready = await waitForUrl(appUrl, 120000, 1000);
      if (ready) {
        console.log("[Rearvy] Website is ready, loading app...");
        void mainWindow.loadURL(appUrl);
        console.log("[Rearvy] mainWindow.loadURL called");
      } else {
        console.error("[Rearvy] Website did not become available");
        dialog.showErrorBox("Timeout", `Website did not become available at ${appUrl} within 120 seconds. Check the terminal for website dev server errors.`);
      }
    } catch (error) {
      console.error("[Rearvy] Fatal error in createMainWindow:", error);
      dialog.showErrorBox("Start failed", `Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(async () => {
  const { session } = require("electron");
  const cachePath = path.join(app.getPath("userData"), "Cache");

  app.commandLine.appendSwitch("disk-cache-dir", cachePath);

  registerRearvyProtocol();

  registerDesktopRequestHeaders();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ? { ...details.responseHeaders } : {};
    
    // Remove headers that prevent iframe embedding for the Live Browser Session
    const headersToRemove = ['x-frame-options', 'content-security-policy'];
    for (const key of Object.keys(responseHeaders)) {
      if (headersToRemove.includes(key.toLowerCase())) {
        delete responseHeaders[key];
      }
    }
    
    callback({
      cancel: false,
      responseHeaders
    });
  });

  Menu.setApplicationMenu(null);

  ipcMain.handle("desktop-mcp-config", async () => {
    return await readDesktopConfig();
  });

  ipcMain.handle("desktop:update:get-state", async () => updateState);

  ipcMain.handle("desktop:local-api-port", async () => localApiPort);

  ipcMain.handle("desktop:update:check", async () => {
    return await checkForDesktopUpdates();
  });

  ipcMain.handle("desktop:update:download", async () => {
    return await downloadDesktopUpdate();
  });

  ipcMain.handle("desktop:update:install", async () => {
    if (!updateState.supported || !updateState.downloaded) {
      return { ok: false, reason: "not-ready" };
    }

    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  // FLERB AI Automation
  setupAutomationIPC(ipcMain);

  initializeDesktopUpdater();

  try {
    const serverInfo = await startLocalServer();
    localApiPort = serverInfo.port;
  } catch (error) {
    console.error("[Rearvy] Failed to start local API server:", error);
  }

  // Auto-launch Blender if not running, then start the bridge
  void autoLaunchBlender().then((result) => {
    if (result?.launched) {
      // Blender was just launched, show helpful message
      setTimeout(() => {
        dialog.showMessageBox({
          type: "info",
          title: "Blender Launched",
          message: "Blender has been launched automatically.",
          detail:
            "To enable 3D editing in Rearvy:\n\n" +
            "1. In Blender, go to: Edit → Preferences → Add-ons\n" +
            "2. Search for 'MCP' or 'blender'\n" +
            "3. Enable the 'Blender MCP' addon\n" +
            "4. Optionally restart Blender\n\n" +
            "Then you can ask Rearvy to 'create a ball' or edit objects.",
          buttons: ["OK"],
        });
      }, 500);
    }
    startBlenderMcpBridge();
  }).catch((err) => {
    console.error("[Rearvy] Error during Blender auto-launch:", err);
    startBlenderMcpBridge(); // Still start bridge in case Blender is already running
  });

  console.log("[Rearvy] About to create main window...");
  createMainWindow();
  console.log("[Rearvy] Main window created successfully");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  console.log("[Rearvy] whenReady handler completed successfully");
});

app.on("before-quit", () => {
  console.log("[Rearvy] before-quit event fired");
  cleanupAutomation();

  if (updateIntervalHandle) {
    clearInterval(updateIntervalHandle);
    updateIntervalHandle = null;
  }

  stopBlenderMcpBridge();
  stopLocalServer();
});

// Handle deep links on macOS
app.on("open-url", (event, url) => {
  console.log("[Rearvy] open-url event fired");
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on("window-all-closed", () => {
  console.log("[Rearvy] window-all-closed event fired");
  if (process.platform !== "darwin") {
    app.quit();
  }
});
