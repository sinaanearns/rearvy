const { createLogger } = require("./lib/logger.cjs");

const log = createLogger("");

log.info("[Rearvy] Starting main process...");

const {
  app,
  BrowserWindow,
  desktopCapturer,
  Menu,
  dialog,
  ipcMain,
  protocol,
  shell,
  screen,
} = require("electron");
log.info("[Rearvy] Electron imports successful");

const path = require("node:path");
const fs = require("fs/promises");
const { startLocalServer, stopLocalServer } = require("./local-server.cjs");
const { initializeAutomation, setupAutomationIPC, cleanupAutomation } = require("./automation-integration.cjs");
const { setupClickyLogic } = require("./clicky-logic.cjs");
const { setupTerminalIPC } = require("./executor/terminal-service.cjs");
const {
  autoLaunchBlender,
  startBlenderMcpBridge,
  stopBlenderMcpBridge,
} = require("./lib/blender-bridge.cjs");
const { listSerialPorts } = require("./lib/serial-ports.cjs");
const { startLocalWebsiteRuntime, waitForUrl } = require("./lib/website-runtime.cjs");
const { registerGlobalWindowShortcuts } = require("./lib/window-lifecycle.cjs");

log.info("[Rearvy] All imports successful");

// Global error handlers
process.on("uncaughtException", (error) => {
  log.error("[Rearvy] Uncaught exception:", error);
  // Attempt graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  log.error("[Rearvy] Unhandled rejection at:", promise, "reason:", reason);
  // Attempt graceful shutdown on critical rejection
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

const APP_ID = "com.rearvy.desktop";
const START_PATH = process.env.REARVY_DESKTOP_START_PATH || "/chat/new";
const CLICKY_OVERLAY_PATH = normalizeRoutePath(process.env.REARVY_CLICKY_OVERLAY_PATH || "/clicky-overlay");
const CLICKY_WAKE_PATH = normalizeRoutePath(process.env.REARVY_CLICKY_WAKE_PATH || "/clicky-listener");
const DEFAULT_DEV_URL = `http://localhost:3000${START_PATH}`;
const APP_PROTOCOL = "rearvy";
const APP_PROTOCOL_HOST = "app";
const DEFAULT_PACKAGED_WEB_PORT = Number(process.env.REARVY_DESKTOP_WEB_PORT || 3010);
const DEFAULT_PACKAGED_APP_URL = `http://127.0.0.1:${DEFAULT_PACKAGED_WEB_PORT}${START_PATH}`;
const DESKTOP_AUTO_START_WEBSITE = process.env.REARVY_DESKTOP_AUTO_START_WEBSITE !== "0";
const DESKTOP_CONFIG_FILENAME = "claude_desktop_config.json";
const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BRIDGE_VERSION = "2026.05.14.1";
const UPDATE_UNAVAILABLE_REASON =
  "Desktop auto-updates are unavailable for this build. Install updates manually from the Rearvy download page.";
const DESKTOP_PERMISSION_NAMES = ["media", "microphone", "display-capture", "usb", "hid", "serial", "bluetooth"];
const DESKTOP_WORKSPACE_SCOPE = {
  mode: "folder",
  path: "",
};

let desktopWorkspaceScope = { ...DESKTOP_WORKSPACE_SCOPE };

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
  },
]);

function isSafeOpenExternalUrl(target) {
  try {
    const parsed = new URL(target);
    return parsed.protocol === "https:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

function normalizeDesktopScope(scope) {
  if (!scope || typeof scope !== "object") {
    return { ...DESKTOP_WORKSPACE_SCOPE };
  }

  const mode = scope.mode === "full-access" ? "full-access" : "folder";
  const rawPath = typeof scope.path === "string" ? scope.path.trim() : "";
  const pathValue = rawPath ? path.resolve(rawPath) : "";

  return { mode, path: pathValue };
}

function isPathInsideScope(targetPath, scopePath) {
  if (!scopePath) {
    return false;
  }

  const normalizedTarget = path.resolve(targetPath);
  const normalizedScope = path.resolve(scopePath);
  const relative = path.relative(normalizedScope, normalizedTarget);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertDesktopPathAllowed(targetPath) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    throw new Error("Path is required");
  }

  if (desktopWorkspaceScope.mode === "full-access") {
    return;
  }

  if (!desktopWorkspaceScope.path) {
    throw new Error("No desktop folder scope is selected. Choose a folder before editing files.");
  }

  if (!isPathInsideScope(targetPath, desktopWorkspaceScope.path)) {
    throw new Error(`Path is outside the selected desktop scope: ${targetPath}`);
  }
}

function setDesktopWorkspaceScope(nextScope) {
  desktopWorkspaceScope = normalizeDesktopScope(nextScope);
  return desktopWorkspaceScope;
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
      log.error("Failed to read desktop MCP config:", error);
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
      const url = commandLine.find((arg) => typeof arg === "string" && arg.startsWith("rearvy://"));
      if (url) {
        handleProtocolUrl(url);
      }

      const openPathPayload = findOpenPathFromCommandLine(commandLine);
      if (openPathPayload) {
        openTerminalForPath(openPathPayload);
      }
    }
  });
}

let mainWindow = null;
let lastMainFrameLoadFailedUrl = null;
let clickyWindow = null;
let clickyWakeWindow = null;
let pendingAuthCredential = null;
let pendingAuthToken = null;
let pendingOpenPath = null;
let desktopRequestHeaderRegistered = false;
let updateIntervalHandle = null;
let updaterInitialized = false;
let autoUpdater = null;
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

pendingOpenPath = findOpenPathFromCommandLine(process.argv);

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

function getDesktopUpdateToken() {
  return (
    process.env.REARVY_UPDATE_GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    ""
  ).trim();
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isGitHubReleaseFeedAccessError(message) {
  return (
    /releases\.atom/i.test(message) &&
    (/404/.test(message) || /authentication token/i.test(message))
  );
}

function formatDesktopUpdateError(error) {
  const message = getErrorMessage(error);

  if (isGitHubReleaseFeedAccessError(message)) {
    return UPDATE_UNAVAILABLE_REASON;
  }

  return message
    .replace(/\s*Headers:\s*\{[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function disableDesktopUpdater(reason = UPDATE_UNAVAILABLE_REASON) {
  log.warn("[Rearvy] Desktop updater disabled:", reason);
  setUpdateState({
    supported: false,
    checking: false,
    updateAvailable: false,
    downloading: false,
    downloaded: false,
    downloadPercent: null,
    lastCheckedAt: Date.now(),
    lastError: null,
  });
}

function getAutoUpdater() {
  if (autoUpdater) {
    return autoUpdater;
  }

  try {
    const fsSync = require("fs");
    const updateYmlPath = path.join(process.resourcesPath || process.cwd(), "app-update.yml");

    // If we're running a packaged app but the app-update.yml file is missing,
    // electron-updater will emit an ENOENT when attempting to read it. Treat
    // that case as "updater unsupported" so we don't surface the raw error
    // to users (the app can continue to run normally without auto-updates).
    if (app.isPackaged && !fsSync.existsSync(updateYmlPath)) {
      log.warn("[Rearvy] app-update.yml not found — disabling desktop updater:", updateYmlPath);
      setUpdateState({
        supported: false,
        checking: false,
        downloading: false,
        lastError: null,
      });
      return null;
    }

    autoUpdater = require("electron-updater").autoUpdater;
    const updateToken = getDesktopUpdateToken();
    if (updateToken) {
      autoUpdater.requestHeaders = {
        Authorization: `token ${updateToken}`,
      };
    }
    return autoUpdater;
  } catch (error) {
    const message = formatDesktopUpdateError(error);
    log.error("[Rearvy] Desktop updater unavailable:", message);
    setUpdateState({
      supported: false,
      checking: false,
      downloading: false,
      lastError: message,
    });
    return null;
  }
}

async function checkForDesktopUpdates() {
  const updater = getAutoUpdater();

  if (!updater || !updaterInitialized || !updateState.supported) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    await updater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const rawMessage = getErrorMessage(error);
    const message = formatDesktopUpdateError(error);

    if (isGitHubReleaseFeedAccessError(rawMessage)) {
      disableDesktopUpdater(message);
      return { ok: false, reason: message };
    }

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
  const updater = getAutoUpdater();

  if (!updater || !updaterInitialized || !updateState.supported || !updateState.updateAvailable) {
    return { ok: false, reason: "no-update" };
  }

  try {
    setUpdateState({ downloading: true, lastError: null });
    await updater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    const message = formatDesktopUpdateError(error);
    setUpdateState({ downloading: false, lastError: message });
    return { ok: false, reason: message };
  }
}

function initializeDesktopUpdater() {
  if (updaterInitialized) {
    return;
  }

  updaterInitialized = true;
  const updater = getAutoUpdater();

  setUpdateState({
    supported: Boolean(updater && app.isPackaged),
    currentVersion: app.getVersion(),
  });

  if (!updater || !app.isPackaged) {
    return;
  }

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;

  updater.on("checking-for-update", () => {
    setUpdateState({
      checking: true,
      updateAvailable: false,
      downloading: false,
      downloaded: false,
      downloadPercent: null,
      lastError: null,
    });
  });

  updater.on("update-available", (info) => {
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

  updater.on("update-not-available", () => {
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

  updater.on("download-progress", (progressObj) => {
    setUpdateState({
      downloading: true,
      downloadPercent:
        typeof progressObj?.percent === "number"
          ? Math.max(0, Math.min(100, progressObj.percent))
          : null,
    });
  });

  updater.on("update-downloaded", (info) => {
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
          updater.quitAndInstall();
        }
      });
  });

  updater.on("error", (error) => {
    const rawMessage = getErrorMessage(error);
    const message = formatDesktopUpdateError(error);

    if (isGitHubReleaseFeedAccessError(rawMessage)) {
      disableDesktopUpdater(message);
      return;
    }

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
  const fallbackUrl = app.isPackaged ? DEFAULT_PACKAGED_APP_URL : DEFAULT_DEV_URL;
  const candidateUrls = app.isPackaged
    ? [process.env.REARVY_DESKTOP_APP_URL, process.env.REARVY_DESKTOP_DEV_URL]
    : [process.env.REARVY_DESKTOP_DEV_URL, process.env.REARVY_DESKTOP_APP_URL];

  for (const candidate of candidateUrls) {
    if (!candidate) {
      continue;
    }

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }

      log.warn(`[Rearvy] Ignoring non-HTTP app URL: ${candidate}`);
    } catch {
      log.warn(`[Rearvy] Ignoring invalid app URL: ${candidate}`);
    }
  }

  // The desktop window must always load the website over HTTP(S).
  return fallbackUrl;
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

function shouldWaitForAppUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getTrustedDesktopOrigins() {
  const origins = new Set([
    "https://www.rearvy.com",
    "https://rearvy.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  for (const candidate of [
    getAppUrl(),
    process.env.REARVY_DESKTOP_DEV_URL,
  ]) {
    try {
      if (candidate) {
        origins.add(new URL(candidate).origin);
      }
    } catch {
      // Ignore invalid custom app URLs.
    }
  }

  return origins;
}

function isTrustedDesktopOrigin(origin) {
  if (typeof origin !== "string" || !origin) {
    return false;
  }

  const normalizedOrigin = origin.toLowerCase();

  if (
    normalizedOrigin === "file://" ||
    normalizedOrigin.startsWith("file:///") ||
    normalizedOrigin.startsWith(`${APP_PROTOCOL}://`) ||
    normalizedOrigin.startsWith("http://localhost") ||
    normalizedOrigin.startsWith("https://localhost") ||
    normalizedOrigin.startsWith("http://127.0.0.1") ||
    normalizedOrigin.startsWith("https://127.0.0.1")
  ) {
    return true;
  }

  try {
    return getTrustedDesktopOrigins().has(new URL(origin).origin);
  } catch {
    return false;
  }
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

let desktopPermissionHandlersRegistered = false;

function registerDesktopPermissionHandlers() {
  if (desktopPermissionHandlersRegistered) {
    return;
  }

  const { session } = require("electron");
  const allowedPermissions = new Set(DESKTOP_PERMISSION_NAMES);

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (!allowedPermissions.has(permission)) {
      return false;
    }

    return isTrustedDesktopOrigin(requestingOrigin) || isTrustedDesktopOrigin(details?.securityOrigin);
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (!allowedPermissions.has(permission)) {
      callback(false);
      return;
    }

    const requestOrigin = details?.securityOrigin || details?.requestingOrigin || webContents?.getURL?.();
    callback(isTrustedDesktopOrigin(requestOrigin));
  });

  session.defaultSession.setDevicePermissionHandler((details) => {
    if (!details || !["usb", "hid", "serial"].includes(details.deviceType)) {
      return false;
    }

    return isTrustedDesktopOrigin(details.origin);
  });

  session.defaultSession.on("select-usb-device", (event, details, callback) => {
    event.preventDefault();

    const deviceToReturn = details?.deviceList?.[0];
    callback(deviceToReturn?.deviceId);
  });

  session.defaultSession.on("select-hid-device", (event, details, callback) => {
    event.preventDefault();

    const deviceToReturn = details?.deviceList?.[0];
    callback(deviceToReturn?.deviceId);
  });

  session.defaultSession.on("select-serial-port", (event, portList, webContents, callback) => {
    event.preventDefault();

    const portToReturn = Array.isArray(portList) ? portList[0] : null;
    callback(portToReturn?.portId || "");
  });

  desktopPermissionHandlersRegistered = true;
}

function buildAppRouteUrl(pathname, searchParams = {}) {
  const currentWindowUrl =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.webContents.getURL()
      : null;
  const baseUrl = currentWindowUrl || getAppUrl();
  const url = new URL(baseUrl);
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

function sendPendingOpenPathToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed() || !pendingOpenPath) {
    return;
  }

  mainWindow.webContents.send("desktop:open-path", pendingOpenPath);
  pendingOpenPath = null;
}

function isTerminalRouteUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.pathname.replace(/\/+$/, "") === "/terminal";
  } catch {
    return false;
  }
}

function routePendingOpenPath() {
  if (!mainWindow || mainWindow.isDestroyed() || !pendingOpenPath) {
    return;
  }

  sendPendingOpenPathToRenderer();
}

function normalizeOpenPathCandidate(candidate) {
  if (!candidate || typeof candidate !== "string") {
    return null;
  }

  if (candidate.startsWith("rearvy://")) {
    return null;
  }

  if (candidate.startsWith("file://")) {
    try {
      const { fileURLToPath } = require("node:url");
      return fileURLToPath(candidate);
    } catch {
      return null;
    }
  }

  return candidate;
}

function createOpenPathPayload(candidate) {
  const openPath = normalizeOpenPathCandidate(candidate);
  if (!openPath || openPath === process.execPath || openPath === process.argv[1]) {
    return null;
  }

  if (!fsSyncExists(openPath)) {
    return null;
  }

  try {
    const fsSync = require("fs");
    const stats = fsSync.statSync(openPath);
    const kind = stats.isDirectory() ? "directory" : "file";
    return {
      path: openPath,
      cwd: kind === "directory" ? openPath : path.dirname(openPath),
      kind,
    };
  } catch {
    return null;
  }
}

function findOpenPathFromCommandLine(commandLine) {
  if (!Array.isArray(commandLine)) {
    return null;
  }

  for (let index = commandLine.length - 1; index >= 0; index -= 1) {
    const payload = createOpenPathPayload(commandLine[index]);
    if (payload) {
      return payload;
    }
  }

  return null;
}

function openTerminalForPath(payload) {
  if (!payload) {
    return;
  }

  pendingOpenPath = payload;

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
  routePendingOpenPath();
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
    log.error("Failed to handle protocol URL:", e);
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
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "website");
  }

  return path.join(__dirname, "..", "website");
}

function getPackagedStandaloneServerPath() {
  const websiteRoot = getPackagedWebsiteRoot();
  const candidates = [
    path.join(websiteRoot, ".next", "standalone", "server.js"),
    path.join(websiteRoot, ".next", "standalone", "website", "server.js"),
  ];

  return candidates.find((candidate) => fsSyncExists(candidate)) || candidates[0];
}

function hasPackagedStandaloneServer() {
  return fsSyncExists(getPackagedStandaloneServerPath());
}

function hasPackagedWebsiteBuild() {
  return Boolean(resolvePackagedWebsiteFile("/chat/new") || resolvePackagedWebsiteFile("/"));
}

function getPackagedFallbackUrl() {
  return process.env.REARVY_DESKTOP_APP_URL || DEFAULT_PACKAGED_APP_URL;
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
      
      // The custom protocol should not be used for serving the app itself
      // All requests should go through the http/localhost server
      // If we're here, the http server isn't running - show an informative error
      
      log.error(`[Rearvy] Custom protocol handler invoked for ${request.url}`);
      log.error("[Rearvy] The app server is not running. Please restart the application.");
      
      // Try to resolve a static file if it exists (for fallback resources only)
      const resolvedPath = resolvePackagedWebsiteFile(requestUrl.pathname || "/");
      if (resolvedPath) {
        log.info(`[Rearvy] Serving static fallback: ${resolvedPath}`);
        callback({ path: resolvedPath });
        return;
      }

      // Return error if no fallback file exists
      callback({ error: -6 });
    } catch (error) {
      log.error("[Rearvy] Failed to handle protocol request:", error);
      callback({ error: -2 });
    }
  });
}

function createMainWindow() {
  log.info("[Rearvy] createMainWindow called");
  const appUrl = getAppUrl();
  log.info(`[Rearvy] App URL: ${appUrl}`);
  const iconPath = path.join(__dirname, "..", "..", "public", "rearvy.ico");
  const preloadPath = path.join(__dirname, "preload.cjs");

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Rearvy",
    autoHideMenuBar: true,
    backgroundColor: "#070b11",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
      webviewTag: true,
      // Enable Blink features needed for device APIs (WebUSB/WebSerial/WebBluetooth)
      enableBlinkFeatures: "WebUSB,WebSerial,WebBluetooth",
    },
  });

  mainWindow.once("ready-to-show", () => {
    log.info("[Rearvy] ready-to-show event fired");
    mainWindow?.show();
    log.info("[Rearvy] Main window shown");
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.once("did-finish-load", async () => {
    log.info("[Rearvy] did-finish-load event fired");
    sendPendingAuthToRenderer();
    broadcastUpdateState();
    broadcastLocalApiPort();

    // Initialize automation
    initializeAutomation(mainWindow, "default-user", process.env.ANTHROPIC_API_KEY || "");

    const desktopConfig = await readDesktopConfig();
    if (desktopConfig) {
      mainWindow.webContents.send("desktop-mcp-config", desktopConfig);
    }
    log.info("[Rearvy] did-finish-load handler completed");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    const currentUrl = mainWindow.webContents.getURL();
    if (!currentUrl.startsWith("chrome-error://")) {
      lastMainFrameLoadFailedUrl = null;
    }

    sendPendingOpenPathToRenderer();
  });

  const enableClickyPanel = (() => {
    const value = (process.env.REARVY_ENABLE_CLICKY_PANEL || "1").toLowerCase();
    return value !== "0" && value !== "false";
  })();

  if (enableClickyPanel) {
    clickyWindow = createClickyWindow(appUrl);
  } else {
    log.info("[Rearvy] Clicky visual panel disabled via REARVY_ENABLE_CLICKY_PANEL");
    clickyWindow = null;
  }

  clickyWakeWindow = createClickyWakeWindow(appUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
    closeAuxiliaryWindow(clickyWindow);
    closeAuxiliaryWindow(clickyWakeWindow);
    clickyWindow = null;
    clickyWakeWindow = null;
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
              enableBlinkFeatures: "WebUSB,WebSerial,WebBluetooth",
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

    // Prevent navigation to unwanted top-level pages in the desktop app
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname || "/";
      const blocked = ["/", "/home", "/download", "/download.html"];
      if (blocked.includes(pathname) || blocked.some((p) => pathname.startsWith(p + "/"))) {
        log.info(`[Rearvy] Blocking navigation to ${pathname} in desktop app; redirecting to ${START_PATH}`);
        event.preventDefault();
        const base = getAppUrl().split("?")[0].split("#")[0];
        const redirect = new URL(base);
        redirect.pathname = START_PATH;
        void mainWindow.loadURL(redirect.toString());
        return;
      }
    } catch (e) {
      // ignore parse errors and allow navigation
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

      const message = `Rearvy could not load ${validatedUrl || appUrl}.\n\n${errorDescription} (Code: ${errorCode})`;
      lastMainFrameLoadFailedUrl = validatedUrl || appUrl;

      // In packaged releases show a blocking error dialog so end-users see the problem.
      // In development, avoid blocking the main process — log and open DevTools instead
      if (app.isPackaged) {
        dialog.showErrorBox("Rearvy could not open", message);
      } else {
        log.error("[Rearvy] did-fail-load:", message);
        try {
          // Open detached DevTools to help developers inspect renderer errors quickly
          mainWindow?.webContents?.openDevTools?.({ mode: "detach" });
        } catch (e) {
          // Ignore openDevTools failures
        }
      }
    }
  );

  log.info("[Rearvy] Loading Rearvy website desktop app...");

  // Guard against accidental use of the custom protocol as the main app URL.
  // If `getAppUrl()` somehow returns a `rearvy://...` origin (for example
  // when environment variables are misconfigured), fall back to the HTTP
  // dev/packaged URL so the BrowserWindow doesn't try to load the
  // custom-protocol which only provides limited fallback resources.
  let resolvedAppUrl = appUrl;
  try {
    const parsedCandidate = new URL(resolvedAppUrl);
    if (parsedCandidate.protocol === `${APP_PROTOCOL}:`) {
      log.warn(`[Rearvy] App URL uses custom protocol (${resolvedAppUrl}). Falling back to HTTP app URL.`);
      resolvedAppUrl = app.isPackaged
        ? (process.env.REARVY_DESKTOP_APP_URL || DEFAULT_PACKAGED_APP_URL)
        : (process.env.REARVY_DESKTOP_DEV_URL || DEFAULT_DEV_URL);
    }
  } catch (e) {
    // If parsing fails, leave resolvedAppUrl as-is and let loadURL handle errors.
  }

  void mainWindow.loadURL(resolvedAppUrl);
  // Open DevTools automatically in development for faster debugging
  if (!app.isPackaged && process.env.REARVY_DESKTOP_OPEN_DEVTOOLS !== "0") {
    try {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } catch (e) {}
  }
}

function normalizeRoutePath(routePath) {
  const trimmed = typeof routePath === "string" ? routePath.trim() : "";
  if (!trimmed) {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function closeAuxiliaryWindow(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  try {
    win.close();
  } catch {}
}

function clampToRange(value, min, max) {
  if (max < min) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function getClickyWorkAreaForPoint(point) {
  try {
    return screen.getDisplayNearestPoint(point).workArea;
  } catch {
    return screen.getPrimaryDisplay().workArea;
  }
}

function setClickyWindowPosition(x, y) {
  if (!clickyWindow || clickyWindow.isDestroyed()) {
    return;
  }

  const bounds = clickyWindow.getBounds();
  const target = { x: Math.round(x), y: Math.round(y) };
  const area = getClickyWorkAreaForPoint(target);
  const margin = 8;
  const nextX = clampToRange(target.x, area.x + margin, area.x + area.width - bounds.width - margin);
  const nextY = clampToRange(target.y, area.y + margin, area.y + area.height - bounds.height - margin);

  clickyWindow.setPosition(nextX, nextY);
}

function keepClickyWindowVisible() {
  if (!clickyWindow || clickyWindow.isDestroyed()) {
    return;
  }

  const bounds = clickyWindow.getBounds();
  setClickyWindowPosition(bounds.x, bounds.y);
}

function loadAuxiliaryWindowWithRetry(win, targetUrl, label) {
  let retryTimer = null;
  let retryCount = 0;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleRetry = (reason) => {
    if (!win || win.isDestroyed()) {
      return;
    }

    clearRetry();
    const delay = Math.min(5000, 1000 + retryCount * 500);
    retryCount += 1;
    log.warn(`[Rearvy] ${label} load failed; retrying in ${delay}ms:`, reason);
    retryTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        void win.loadURL(targetUrl).catch((error) => scheduleRetry(error?.message || String(error)));
      }
    }, delay);
  };

  win.webContents.on("did-finish-load", () => {
    retryCount = 0;
    clearRetry();
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
    if (isMainFrame === false || errorCode === -3) {
      return;
    }

    scheduleRetry(`${errorDescription} (${errorCode})`);
  });

  win.on("closed", clearRetry);
  void win.loadURL(targetUrl).catch((error) => scheduleRetry(error?.message || String(error)));
}

function createClickyWindow(appUrl) {
  try {
    const clickyUrl = new URL(CLICKY_OVERLAY_PATH, appUrl).toString();
    const preloadPath = path.join(__dirname, "preload.cjs");

    const win = new BrowserWindow({
      width: 108,
      height: 108,
      minWidth: 108,
      minHeight: 108,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      title: "Clicky",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: preloadPath,
        backgroundThrottling: false,
      },
    });

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "screen-saver");

    const displayArea = screen.getPrimaryDisplay().workArea;
    const margin = 24;
    win.setPosition(
      Math.max(displayArea.x + margin, displayArea.x + displayArea.width - 108 - margin),
      Math.max(displayArea.y + margin, displayArea.y + displayArea.height - 108 - margin)
    );

    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) {
        win.showInactive();
      }
    });

    win.on("closed", () => {
      if (clickyWindow === win) {
        clickyWindow = null;
      }
    });

    loadAuxiliaryWindowWithRetry(win, clickyUrl, "Clicky window");
    return win;
  } catch (error) {
    log.error("[Rearvy] Failed to create Clicky window:", error);
    return null;
  }
}

function createClickyWakeWindow(appUrl) {
  try {
    const wakeUrl = new URL(CLICKY_WAKE_PATH, appUrl).toString();
    const preloadPath = path.join(__dirname, "preload.cjs");

    const win = new BrowserWindow({
      width: 1,
      height: 1,
      show: true,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      skipTaskbar: true,
      opacity: 0,
      title: "Clicky Wake Listener",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: preloadPath,
        backgroundThrottling: false,
      },
    });

    win.setVisibleOnAllWorkspaces(false);

    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) {
        win.showInactive();
        try {
          win.setOpacity(0);
        } catch {}
      }
    });

    win.on("closed", () => {
      if (clickyWakeWindow === win) {
        clickyWakeWindow = null;
      }
    });

    loadAuxiliaryWindowWithRetry(win, wakeUrl, "Clicky wake listener");
    return win;
  } catch (error) {
    log.error("[Rearvy] Failed to create Clicky wake listener window:", error);
    return null;
  }
}

app.setAppUserModelId(APP_ID);

registerGlobalWindowShortcuts(app);

app.whenReady().then(async () => {
  const { session } = require("electron");
  const cachePath = path.join(app.getPath("userData"), "Cache");
  const projectRoot = path.resolve(__dirname, "..");

  app.commandLine.appendSwitch("disk-cache-dir", cachePath);

  registerRearvyProtocol();

  registerDesktopRequestHeaders();
  registerDesktopPermissionHandlers();

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

  ipcMain.handle("desktop:get-capabilities", async () => ({
    appVersion: app.getVersion(),
    bridgeVersion: BRIDGE_VERSION,
    platform: process.platform,
    isPackaged: app.isPackaged,
    appUrl: getAppUrl(),
    terminal: true,
    localApi: {
      available: typeof localApiPort === "number",
      port: localApiPort,
    },
    devicePermissions: {
      autoGrant: true,
      trustedOrigins: Array.from(getTrustedDesktopOrigins()),
      permissions: DESKTOP_PERMISSION_NAMES,
    },
    automation: true,
    clicky: true,
  }));

  ipcMain.handle("desktop:system:open-external", async (event, { url }) => {
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle("desktop:workspace:get-scope", async () => {
    return desktopWorkspaceScope;
  });

  ipcMain.handle("desktop:workspace:set-scope", async (_event, scope) => {
    return setDesktopWorkspaceScope(scope);
  });

  ipcMain.handle("desktop:workspace:pick-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Rearvy Desktop scope",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return desktopWorkspaceScope;
    }

    return setDesktopWorkspaceScope({ mode: "folder", path: result.filePaths[0] });
  });

  ipcMain.handle("desktop:file:pick-open", async (_event, { filters }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "openDirectory"],
      filters: Array.isArray(filters) ? filters : undefined,
      title: "Open file or folder",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("desktop:file:pick-save", async (_event, { defaultPath, filters }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: Array.isArray(filters) ? filters : undefined,
      title: "Save file as",
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    assertDesktopPathAllowed(result.filePath);
    return result.filePath;
  });

  ipcMain.handle("desktop:file:read-text", async (_event, { filePath }) => {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("filePath is required");
    }

    assertDesktopPathAllowed(filePath);
    return await fs.readFile(filePath, "utf8");
  });

  ipcMain.handle("desktop:file:write-text", async (_event, { filePath, content }) => {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("filePath is required");
    }

    assertDesktopPathAllowed(filePath);
    await fs.writeFile(filePath, content ?? "", "utf8");
    return { ok: true };
  });

  ipcMain.handle("desktop:system:capture-screen", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
      fetchWindowIcons: false,
    });

    const screenSource = sources[0];
    return screenSource ? screenSource.thumbnail.toDataURL() : null;
  });

  ipcMain.handle("desktop:device:list-serial-ports", listSerialPorts);

  ipcMain.handle("desktop:system:reveal-in-folder", async (event, { filePath }) => {
    assertDesktopPathAllowed(filePath);
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  // Receive forwarded console logs from renderer preload and print them in main logs
  ipcMain.on('preload:console', (event, level, message) => {
    try {
      const out = `[Renderer:${level}] ${message}`;
      if (level === 'error') {
        log.error(out);
      } else if (level === 'warn') {
        log.warn(out);
      } else {
        log.info(out);
      }
    } catch (e) {
      log.info('[Renderer] (failed to log forwarded message)');
    }
  });

  ipcMain.handle("desktop:open-devtools", (event) => {
    const webContents = event.sender;
    webContents.openDevTools({ mode: "detach" });

      ipcMain.on("preload:loading", (event) => {
        log.info("[Rearvy] ✓ Preload script loaded successfully");
        ipcMain.on("preload:ready", (event, data) => {
          log.info("[Rearvy] ✓ Preload bridge ready, systemKeys:", data.systemKeys);
        });

      });
    return { success: true };
  });

  ipcMain.on("clicky:set-position", (_event, { x, y }) => {
    setClickyWindowPosition(x, y);
  });

  ipcMain.on("clicky:set-size", (_event, { width, height }) => {
    if (clickyWindow && !clickyWindow.isDestroyed()) {
      clickyWindow.setContentSize(Math.round(width), Math.round(height));
      keepClickyWindowVisible();
    }
  });

  ipcMain.handle("clicky:get-mouse-position", () => {
    return screen.getCursorScreenPoint();
  });

  ipcMain.handle("desktop:update:check", async () => {
    return await checkForDesktopUpdates();
  });

  ipcMain.handle("desktop:update:download", async () => {
    return await downloadDesktopUpdate();
  });

  ipcMain.handle("desktop:update:install", async () => {
    const updater = getAutoUpdater();

    if (!updater || !updateState.supported || !updateState.downloaded) {
      return { ok: false, reason: "not-ready" };
    }

    updater.quitAndInstall();
    return { ok: true };
  });

  // FLERB AI Automation
  setupAutomationIPC(ipcMain);

  initializeDesktopUpdater();

  let apiStartAttempts = 0;
  const maxApiAttempts = 3;
  
  async function initializeLocalAPI() {
    try {
      apiStartAttempts++;
      log.info(`[Rearvy] Attempting to start local API (attempt ${apiStartAttempts}/${maxApiAttempts})...`);
      
      const serverInfo = await startLocalServer();
      localApiPort = serverInfo.port;
      log.info(`[Rearvy] ✓ Local API started successfully on port ${localApiPort}`);
      
      // Notify renderer processes that the local API port is now available
      broadcastLocalApiPort();
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const fullError = error instanceof Error ? error.stack : String(error);
      
      log.error(`[Rearvy] ✗ Failed to start local API (attempt ${apiStartAttempts}/${maxApiAttempts}):`, errorMsg);
      log.error(`[Rearvy] Full error:`, fullError);
      
      if (apiStartAttempts < maxApiAttempts) {
        log.info(`[Rearvy] Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return initializeLocalAPI();
      }
      
      log.error(`[Rearvy] ✗ Failed to start local API after ${maxApiAttempts} attempts`);
      return false;
    }
  }
  
  void initializeLocalAPI().then((apiInitialized) => {
    if (!apiInitialized && mainWindow && !mainWindow.isDestroyed()) {
      log.error("[Rearvy] Local API initialization failed; Automation features will not work");
    }
  });

  const enableBlenderMode = process.env.REARVY_ENABLE_BLENDER === "1";

  if (enableBlenderMode) {
    log.info("[Rearvy] Blender mode enabled, starting Blender MCP bridge...");
    void autoLaunchBlender()
      .then((result) => {
        if (result?.launched) {
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

        startBlenderMcpBridge({ dialog, projectRoot });
      })
      .catch((err) => {
        log.error("[Rearvy] Error during Blender auto-launch:", err);
        startBlenderMcpBridge({ dialog, projectRoot });
      });
  } else {
    log.info("[Rearvy] Blender mode is disabled by default. Set REARVY_ENABLE_BLENDER=1 or use npm run desktop:dev:blender when you need Blender tools.");
  }

  log.info("[Rearvy] About to create main window...");

  // Start the website runtime but do not block main window creation on long waits.
  // Older behavior awaited the runtime and performed lengthy `waitForUrl()` calls
  // which could delay the UI for many seconds. Default behavior can be restored
  // by setting REARVY_DESKTOP_WAIT_FOR_APP_URL=1. Set to "0" to skip waiting.
  const waitForAppAtStartup = process.env.REARVY_DESKTOP_WAIT_FOR_APP_URL !== "0";

  // Kick off website runtime in background. Do not await here.
  const websitePromise = startLocalWebsiteRuntime({
    autoStartWebsite: DESKTOP_AUTO_START_WEBSITE,
    defaultPackagedAppUrl: DEFAULT_PACKAGED_APP_URL,
    defaultPackagedWebPort: DEFAULT_PACKAGED_WEB_PORT,
    isPackaged: app.isPackaged,
    projectRoot,
    userDataPath: app.getPath("userData"),
    websiteRoot: getPackagedWebsiteRoot(),
  })
    .then((started) => {
      if (started === false && app.isPackaged) {
        const remoteFallback =
          process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
          process.env.REARVY_REMOTE_APP_URL ||
          "https://www.rearvy.com";
        process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
        log.warn(`[Rearvy] Local website runtime did not start; falling back to remote URL: ${remoteFallback}`);
      }
      return started;
    })
    .catch((e) => {
      log.error("[Rearvy] startLocalWebsiteRuntime error (background):", e);
      return false;
    });

  let appUrl = getAppUrl();
  log.info(`[Rearvy] App URL resolved to: ${appUrl}, app.isPackaged=${app.isPackaged}, autoStartWebsite=${DESKTOP_AUTO_START_WEBSITE}`);

  // Short blocking health-check for packaged builds: prefer a quick fallback
  // to the remote hosted UI when the local packaged website is not reachable.
  // This avoids Chromium showing a blocking ERR_CONNECTION_REFUSED dialog
  // to end-users when the desktop app is packaged and the local server is down.
  try {
    const waitForAppAtStartup = process.env.REARVY_DESKTOP_WAIT_FOR_APP_URL !== "0";
    if (app.isPackaged && shouldWaitForAppUrl(appUrl) && waitForAppAtStartup) {
      log.info(`[Rearvy] (startup) Performing short health-check for app URL: ${appUrl}`);
      // Wait up to 3s for the URL to respond; treat failure as unreachable.
      const ready = await Promise.race([
        waitForUrl(appUrl, 3000),
        new Promise((res) => setTimeout(() => res(false), 3000)),
      ]);

      if (!ready) {
        const remoteFallback =
          process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
          process.env.REARVY_REMOTE_APP_URL ||
          "https://www.rearvy.com";

        if (appUrl !== remoteFallback) {
          log.warn(`[Rearvy] (startup) App URL unreachable within 3s; switching to remote fallback: ${remoteFallback}`);
          process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
          appUrl = getAppUrl();
          log.info(`[Rearvy] (startup) New appUrl: ${appUrl}`);
        }
      } else {
        log.info(`[Rearvy] (startup) App URL reachable: ${appUrl}`);
      }
    }
  } catch (e) {
    log.error('[Rearvy] (startup) health-check failed:', e);
  }

  // Non-blocking health check: if configured, perform a background wait with
  // logging but do NOT prevent the main window from showing quickly.
  if (shouldWaitForAppUrl(appUrl) && waitForAppAtStartup) {
    (async () => {
      try {
        const appUrlWaitMs = app.isPackaged ? 5000 : 30000;
        log.info(`[Rearvy] (background) Waiting up to ${appUrlWaitMs / 1000}s for app URL: ${appUrl}`);
        const ready = await Promise.race([waitForUrl(appUrl, appUrlWaitMs), new Promise((res) => setTimeout(() => res(false), appUrlWaitMs))]);
        if (ready) {
          log.info(`[Rearvy] (background) App URL is available: ${appUrl}`);
          if (!app.isPackaged && mainWindow && !mainWindow.isDestroyed()) {
            const currentUrl = mainWindow.webContents.getURL();
            if (!currentUrl || currentUrl.startsWith("chrome-error://") || lastMainFrameLoadFailedUrl === appUrl) {
              log.info(`[Rearvy] (background) Reloading app URL after website startup: ${appUrl}`);
              lastMainFrameLoadFailedUrl = null;
              void mainWindow.loadURL(appUrl);
            }
          }
        } else {
          log.warn(`[Rearvy] (background) App URL not ready within ${appUrlWaitMs / 1000}s: ${appUrl}`);
          // If packaged, try remote fallback in background
          if (app.isPackaged) {
            const remoteFallback =
              process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
              process.env.REARVY_REMOTE_APP_URL ||
              "https://www.rearvy.com";
            if (appUrl !== remoteFallback) {
              log.info(`[Rearvy] (background) attempting remote fallback: ${remoteFallback}`);
              process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
            }
          }
        }
      } catch (e) {
        log.error("[Rearvy] (background) Error while waiting for app URL:", e);
      }
    })();
  } else if (shouldWaitForAppUrl(appUrl) && !waitForAppAtStartup) {
    log.info('[Rearvy] Skipping wait for app URL at startup (REARVY_DESKTOP_WAIT_FOR_APP_URL=0)');
  }

  // Create the main window immediately so the UI appears quickly for users.
  createMainWindow();
  setupClickyLogic(mainWindow, clickyWindow, appUrl);
  setupTerminalIPC(ipcMain, mainWindow);
  log.info("[Rearvy] Main window created successfully");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  log.info("[Rearvy] whenReady handler completed successfully");
});

app.on("before-quit", () => {
  log.info("[Rearvy] before-quit event fired");
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
  log.info("[Rearvy] open-url event fired");
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on("window-all-closed", () => {
  log.info("[Rearvy] window-all-closed event fired");
  if (process.platform !== "darwin") {
    app.quit();
  }
});
