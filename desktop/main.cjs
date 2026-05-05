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

const APP_ID = "com.rearvy.desktop";
const DEFAULT_APP_URL = "https://www.rearvy.com";
const DEFAULT_DEV_URL = "http://localhost:3000";
const DESKTOP_SIGNIN_PATH = "/login";
const DESKTOP_SIGNIN_REDIRECT = "/chat";
const PRIMARY_DESKTOP_CONFIG_FILENAME = "rearvyconfigure.json";
const LEGACY_DESKTOP_CONFIG_FILENAMES = [
  "rearvycofigure.json",
  "claude_desktop_config.json",
];
const DESKTOP_CONFIG_FILENAMES = [
  PRIMARY_DESKTOP_CONFIG_FILENAME,
  ...LEGACY_DESKTOP_CONFIG_FILENAMES,
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeArgs(args) {
  if (!Array.isArray(args)) {
    return [];
  }

  return args.filter((value) => typeof value === "string" && value.trim().length > 0);
}

function normalizeEnv(env) {
  if (!isPlainObject(env)) {
    return undefined;
  }

  const entries = Object.entries(env)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => [key, value.trim()]);

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeDesktopServer(name, server) {
  if (typeof name !== "string" || !name.trim()) {
    return null;
  }

  const command =
    typeof server.command === "string" && server.command.trim().length > 0
      ? server.command.trim()
      : undefined;
  const url =
    typeof server.url === "string" && server.url.trim().length > 0
      ? server.url.trim()
      : undefined;
  const args = normalizeArgs(server.args);
  const env = normalizeEnv(server.env);

  return {
    name: name.trim(),
    type: server.type === "sse" || url ? "sse" : "stdio",
    ...(command ? { command } : {}),
    ...(args.length ? { args } : {}),
    ...(env ? { env } : {}),
    ...(url ? { url } : {}),
  };
}

function normalizeDesktopConfig(parsed) {
  if (!isPlainObject(parsed)) {
    return [];
  }

  if (isPlainObject(parsed.mcpServers)) {
    return Object.entries(parsed.mcpServers)
      .map(([name, server]) => normalizeDesktopServer(name, isPlainObject(server) ? server : {}))
      .filter(Boolean);
  }

  if (Array.isArray(parsed.mcp_servers)) {
    return parsed.mcp_servers
      .map((server) => normalizeDesktopServer(server.name, isPlainObject(server) ? server : {}))
      .filter(Boolean);
  }

  if (Array.isArray(parsed.servers)) {
    return parsed.servers
      .map((server) => normalizeDesktopServer(server.name, isPlainObject(server) ? server : {}))
      .filter(Boolean);
  }

  return [];
}

function buildCanonicalDesktopConfig(servers, preferences) {
  const mcpServers = Object.fromEntries(
    servers.map((server) => [
      server.name,
      {
        type: server.type,
        ...(server.command ? { command: server.command } : {}),
        ...(server.args?.length ? { args: server.args } : {}),
        ...(server.env && Object.keys(server.env).length ? { env: server.env } : {}),
        ...(server.url ? { url: server.url } : {}),
      },
    ])
  );

  const config = { mcpServers };
  if (preferences && Object.keys(preferences).length > 0) {
    config.preferences = preferences;
  }

  return config;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readDesktopConfig() {
  const homeDir = app.getPath("home");

  for (const filename of DESKTOP_CONFIG_FILENAMES) {
    const configPath = path.join(homeDir, filename);

    try {
      const raw = await fs.readFile(configPath, "utf8");
      const parsed = JSON.parse(raw);
      const servers = normalizeDesktopConfig(parsed);

      if (!servers.length) {
        continue;
      }

      const preferences = isPlainObject(parsed.preferences) ? parsed.preferences : undefined;
      const canonicalConfig = buildCanonicalDesktopConfig(servers, preferences);

      if (filename !== PRIMARY_DESKTOP_CONFIG_FILENAME) {
        const primaryConfigPath = path.join(homeDir, PRIMARY_DESKTOP_CONFIG_FILENAME);
        if (!(await fileExists(primaryConfigPath))) {
          try {
            await fs.writeFile(primaryConfigPath, JSON.stringify(canonicalConfig, null, 2), "utf8");
          } catch (writeError) {
            console.error("Failed to create rearvyconfigure.json:", writeError);
          }
        }
      }

      return {
        ...canonicalConfig,
        mcp_servers: servers,
        servers,
      };
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        console.error("Failed to read desktop MCP config:", error);
      }
    }
  }

  return null;
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

function getAppUrl() {
  if (!app.isPackaged) {
    return (
      process.env.REARVY_DESKTOP_APP_URL ||
      process.env.REARVY_DESKTOP_DEV_URL ||
      DEFAULT_DEV_URL
    );
  }

  return process.env.REARVY_DESKTOP_APP_URL || DEFAULT_APP_URL;
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

ipcMain.on("auth-credential", (_event, credential) => {
  pendingAuthCredential = credential;
  sendPendingAuthToRenderer();
});

ipcMain.on("auth-token", (_event, token) => {
  pendingAuthToken = token;
  sendPendingAuthToRenderer();
});

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
  const iconPath = path.join(__dirname, "..", "public", "favicon.svg");
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

  void mainWindow.loadURL(desktopSigninUrl);
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  const { session } = require("electron");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
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

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
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
