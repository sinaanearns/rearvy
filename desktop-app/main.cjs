/* eslint-disable @typescript-eslint/no-require-imports */
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("fs/promises");
const { spawn } = require("child_process");

const APP_ID = "com.rearvy.desktop";
const DEFAULT_APP_URL = "https://www.rearvy.com";
const DEFAULT_DEV_URL = "http://localhost:3000";
const DEFAULT_PACKAGED_LOCAL_URL = "http://127.0.0.1:3000";
const DESKTOP_SIGNIN_PATH = "/login";
const DESKTOP_SIGNIN_REDIRECT = "/chat";
const DESKTOP_CONFIG_FILENAME = "claude_desktop_config.json";
const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

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

function getAppUrl() {
  if (!app.isPackaged) {
    return (
      process.env.REARVY_DESKTOP_DEV_URL ||
      process.env.REARVY_DESKTOP_APP_URL ||
      DEFAULT_DEV_URL
    );
  }

  return process.env.REARVY_DESKTOP_APP_URL || DEFAULT_PACKAGED_LOCAL_URL;
}

function isLocalAppUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function waitForUrl(url, timeout = 30000, interval = 500) {
  return new Promise((resolve) => {
    const { URL } = require("url");
    const parsed = new URL(url);
    const httpMod = parsed.protocol === "https:" ? require("https") : require("http");

    const start = Date.now();

    function tryOnce() {
      const req = httpMod.request(
        { method: "HEAD", hostname: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? 443 : 80), path: parsed.pathname || "/", timeout: 3000 },
        (res) => {
          res.resume();
          resolve(true);
        }
      );

      req.on("error", () => {
        if (Date.now() - start >= timeout) {
          resolve(false);
        } else {
          setTimeout(tryOnce, interval);
        }
      });

      req.on("timeout", () => {
        req.destroy();
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

function startBlenderMcpBridge() {
  if (app.isPackaged || blenderMcpProcess) {
    return;
  }

  console.log("[Rearvy] Starting Blender MCP bridge...");

  const projectRoot = path.join(__dirname, "..");

  blenderMcpProcess = spawn("npm", ["run", "blender:mcp-bridge", "--", "--port", "3002"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  blenderMcpProcess.stdout?.on("data", (data) => {
    console.log(`[Blender MCP] ${data.toString().trim()}`);
  });

  blenderMcpProcess.stderr?.on("data", (data) => {
    console.error(`[Blender MCP Error] ${data.toString().trim()}`);
  });

  blenderMcpProcess.on("error", (error) => {
    console.error("[Blender MCP] Failed to start:", error);
    blenderMcpProcess = null;
  });

  blenderMcpProcess.on("exit", (code, signal) => {
    console.log(`[Blender MCP] Exited with code ${code}, signal ${signal}`);
    blenderMcpProcess = null;
  });
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

function getDesktopSigninUrl() {
  return buildAppRouteUrl(DESKTOP_SIGNIN_PATH, {
    redirect: DESKTOP_SIGNIN_REDIRECT,
  });
}

function shouldShowDesktopSignin(rawUrl, appUrl) {
  try {
    const parsed = new URL(rawUrl);
    const appOrigin = new URL(appUrl).origin;

    return (
      parsed.origin === appOrigin &&
      (parsed.pathname === "/" || parsed.pathname === "/download")
    );
  } catch {
    return false;
  }
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
      return false;
    }

    if (parsed.origin === appOrigin) {
      if (parsed.pathname === "/auth/desktop-signin") {
        return true;
      }
      return true;
    }

    // Google URLs should be opened in external browser to avoid "Untrusted Browser" issues
    if (host === "accounts.google.com" || host.endsWith(".google.com")) {
      return false;
    }

    return (
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

function createMainWindow() {
  const appUrl = getAppUrl();
  const desktopSigninUrl = getDesktopSigninUrl();
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
    mainWindow?.show();
  });

  mainWindow.webContents.once("did-finish-load", async () => {
    sendPendingAuthToRenderer();

    const desktopConfig = await readDesktopConfig();
    if (desktopConfig) {
      mainWindow.webContents.send("desktop-mcp-config", desktopConfig);
    }
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

    if (shouldShowDesktopSignin(url, appUrl)) {
      event.preventDefault();
      void mainWindow?.loadURL(desktopSigninUrl);
    }
  });

  const enforceSigninStartRoute = (_event, url) => {
    if (shouldShowDesktopSignin(url, appUrl)) {
      void mainWindow?.loadURL(desktopSigninUrl);
    }
  };

  mainWindow.webContents.on("did-navigate", enforceSigninStartRoute);
  mainWindow.webContents.on("did-navigate-in-page", enforceSigninStartRoute);

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

  // Before loading, ensure the app URL is reachable (helpful in dev when website isn't running)
  (async () => {
    const appUrl = getAppUrl();
    const projectRoot = path.join(__dirname, "..");
    const available = await waitForUrl(appUrl, 2000, 200);

    if (available) {
      void mainWindow.loadURL(desktopSigninUrl);
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
      void mainWindow.loadURL(desktopSigninUrl);
    } else {
      dialog.showErrorBox("Timeout", `Website did not become available at ${appUrl} within 120 seconds. Check the terminal for website dev server errors.`);
    }
  })();
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  const { session } = require("electron");
  const cachePath = path.join(app.getPath("userData"), "Cache");

  app.commandLine.appendSwitch("disk-cache-dir", cachePath);

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

  startBlenderMcpBridge();

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  stopBlenderMcpBridge();
});

// Handle deep links on macOS
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
