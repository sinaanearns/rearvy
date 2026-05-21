/* eslint-disable @typescript-eslint/no-require-imports */
console.log("[Rearvy] Starting main process...");

const {
  app,
  BrowserWindow,
  desktopCapturer,
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
const { startLocalServer, stopLocalServer } = require("./local-server.cjs");
const { initializeAutomation, setupAutomationIPC, cleanupAutomation } = require("./automation-integration.cjs");
const { setupClickyLogic } = require("./clicky-logic.cjs");
const { setupTerminalIPC } = require("./executor/terminal-service.cjs");

console.log("[Rearvy] All imports successful");

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("[Rearvy] Uncaught exception:", error);
  // Attempt graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Rearvy] Unhandled rejection at:", promise, "reason:", reason);
  // Attempt graceful shutdown on critical rejection
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

const APP_ID = "com.rearvy.desktop";
const START_PATH = process.env.REARVY_DESKTOP_START_PATH || "/login";
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
const DESKTOP_PERMISSION_NAMES = ["media", "display-capture", "usb", "hid", "serial", "bluetooth"];

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
let clickyWindow = null;
let pendingAuthCredential = null;
let pendingAuthToken = null;
let pendingOpenPath = null;
let blenderMcpProcess = null;
let desktopRequestHeaderRegistered = false;
const websiteRuntimePort = null;
const websiteRuntimeStartPromise = null;
let blenderAddonWarningShown = false;
let blenderBridgePortWarningShown = false;
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
      console.warn("[Rearvy] app-update.yml not found — disabling desktop updater:", updateYmlPath);
      setUpdateState({
        supported: false,
        checking: false,
        downloading: false,
        lastError: null,
      });
      return null;
    }

    autoUpdater = require("electron-updater").autoUpdater;
    return autoUpdater;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Rearvy] Desktop updater unavailable:", message);
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
  const updater = getAutoUpdater();

  if (!updater || !updaterInitialized || !updateState.supported || !updateState.updateAvailable) {
    return { ok: false, reason: "no-update" };
  }

  try {
    setUpdateState({ downloading: true, lastError: null });
    await updater.downloadUpdate();
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

      console.warn(`[Rearvy] Ignoring non-HTTP app URL: ${candidate}`);
    } catch {
      console.warn(`[Rearvy] Ignoring invalid app URL: ${candidate}`);
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
  if (!DESKTOP_AUTO_START_WEBSITE) {
    console.log("[Rearvy] Desktop configured to NOT auto-start website runtime (REARVY_DESKTOP_AUTO_START_WEBSITE=0)");
    return false;
  }
  
  const websiteRoot = getPackagedWebsiteRoot();
  const productionBuildId = path.join(websiteRoot, ".next", "BUILD_ID");
  const productionStandaloneServer = path.join(websiteRoot, ".next", "standalone", "server.js");

  let command;
  let commandArgs;
  let cwd;
  let envOverrides = {};

  // In desktop dev mode, always run the website dev server so recent source
  // changes are reflected immediately and we don't accidentally boot stale
  // `next start` output from an older build.
  if (!app.isPackaged) {
    command = "npm";
    commandArgs = ["run", "dev:web"];
    cwd = projectRoot;
    console.log("[Rearvy] Desktop dev mode detected, starting website dev server with npm run dev:web...");
    console.log(`[Rearvy] Working directory: ${cwd}`);
    console.log(`[Rearvy] Command: ${command} ${commandArgs.join(" ")}`);
  } else {
    try {
      await fs.access(productionStandaloneServer);
      command = process.execPath;
      commandArgs = [productionStandaloneServer];
      cwd = path.dirname(productionStandaloneServer);
      envOverrides = {
        PORT: String(DEFAULT_PACKAGED_WEB_PORT),
        HOSTNAME: "127.0.0.1",
      };
      process.env.REARVY_DESKTOP_APP_URL = DEFAULT_PACKAGED_APP_URL;
      console.log("[Rearvy] Starting packaged website runtime with Next standalone server...");
      console.log(`[Rearvy] Server path: ${productionStandaloneServer}`);
    } catch {
      try {
        await fs.access(productionBuildId);
        const nextBin = path.join(websiteRoot, "node_modules", "next", "dist", "bin", "next");
        command = process.execPath;
        commandArgs = [nextBin, "start", "-p", String(DEFAULT_PACKAGED_WEB_PORT)];
        cwd = websiteRoot;
        process.env.REARVY_DESKTOP_APP_URL = DEFAULT_PACKAGED_APP_URL;
        console.log("[Rearvy] Starting packaged website runtime with local Next server...");
        console.log(`[Rearvy] Website root: ${websiteRoot}`);
      } catch {
        console.error("[Rearvy] Packaged website runtime not found under:", websiteRoot);
        console.error("[Rearvy] Searched for:");
        console.error(`  - ${productionStandaloneServer}`);
        console.error(`  - Next build (BUILD_ID at ${productionBuildId})`);
        // Set a remote fallback so the packaged desktop app can continue
        // to open a hosted web UI instead of failing with protocol errors.
        const remoteFallback =
          process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
          process.env.REARVY_REMOTE_APP_URL ||
          "https://www.rearvy.com";
        process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
        console.warn(`[Rearvy] No packaged website runtime found — falling back to ${remoteFallback}`);
        return false;
      }
    }
  }

  try {
    console.log(`[Rearvy] Spawning website runtime: ${command} ${commandArgs.join(" ")}`);
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      detached: true,
      env: command === process.execPath
        ? {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            ...envOverrides,
          }
        : process.env,
    });

    // Log first error/output from the spawned server to help debug issues
    let stderrCaptured = "";
    let stdoutCaptured = "";
    const captureTimeout = setTimeout(() => {
      if (stderrCaptured.includes("error") || stderrCaptured.includes("Error")) {
        console.error("[Rearvy] Website server startup error:", stderrCaptured.substring(0, 500));
      }
      if (stdoutCaptured.includes("port") || stdoutCaptured.includes("listening") || stdoutCaptured.includes("ready")) {
        console.log("[Rearvy] Website server started:", stdoutCaptured.substring(0, 500));
      }
    }, 2000);

    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderrCaptured += text;
      console.log("[Rearvy:WebServer:stderr]", text);
    });

    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdoutCaptured += text;
      console.log("[Rearvy:WebServer:stdout]", text);
    });

    child.on("error", (err) => {
      console.error("[Rearvy] Failed to spawn website runtime:", err.message);
      // Persist any captured output to assist debugging
      try {
        const logPath = path.join(app.getPath("userData"), "website-start.log");
        const summary = `Failed to spawn website runtime: ${err?.message || String(err)}\n\nSTDOUT:\n${stdoutCaptured}\n\nSTDERR:\n${stderrCaptured}`;
        // fire-and-forget
        fs.writeFile(logPath, summary).catch(() => {});
        console.error(`[Rearvy] Wrote website startup failure log to ${logPath}`);
      } catch (e) {
        // ignore file-write errors
      }

      clearTimeout(captureTimeout);
    });

    child.on("exit", (code, signal) => {
      try {
        const logPath = path.join(app.getPath("userData"), "website-start.log");
        const summary = `Website runtime exited. code=${code} signal=${signal}\n\nSTDOUT:\n${stdoutCaptured}\n\nSTDERR:\n${stderrCaptured}`;
        fs.writeFile(logPath, summary).catch(() => {});
        console.log(`[Rearvy] Website runtime exit info written to ${logPath}`);
      } catch (e) {}
    });

    child.unref();
    clearTimeout(captureTimeout);
    // Also write an initial capture so there's a file even when server hasn't yet emitted exit
    try {
      const logPath = path.join(app.getPath("userData"), "website-start.log");
      const initial = `Website runtime started (spawned). CMD: ${command} ${commandArgs.join(" ")}\n\nSTDOUT (initial):\n${stdoutCaptured}\n\nSTDERR (initial):\n${stderrCaptured}`;
      fs.writeFile(logPath, initial).catch(() => {});
    } catch (e) {}

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

function stopBlenderMcpBridge() {
  if (!blenderMcpProcess) {
    return;
  }

  console.log("[Rearvy] Stopping Blender MCP bridge...");
  blenderMcpProcess.kill();
  blenderMcpProcess = null;
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
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "website");
  }

  return path.join(__dirname, "..", "website");
}

function getPackagedStandaloneServerPath() {
  return path.join(getPackagedWebsiteRoot(), ".next", "standalone", "server.js");
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
      
      console.error(`[Rearvy] Custom protocol handler invoked for ${request.url}`);
      console.error("[Rearvy] The app server is not running. Please restart the application.");
      
      // Try to resolve a static file if it exists (for fallback resources only)
      const resolvedPath = resolvePackagedWebsiteFile(requestUrl.pathname || "/");
      if (resolvedPath) {
        console.log(`[Rearvy] Serving static fallback: ${resolvedPath}`);
        callback({ path: resolvedPath });
        return;
      }

      // Return error if no fallback file exists
      callback({ error: -6 });
    } catch (error) {
      console.error("[Rearvy] Failed to handle protocol request:", error);
      callback({ error: -2 });
    }
  });
}

function createMainWindow() {
  console.log("[Rearvy] createMainWindow called");
  const appUrl = getAppUrl();
  console.log(`[Rearvy] App URL: ${appUrl}`);
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
    console.log("[Rearvy] ready-to-show event fired");
    mainWindow?.show();
    console.log("[Rearvy] Main window shown");
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
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

  mainWindow.webContents.on("did-finish-load", () => {
    sendPendingOpenPathToRenderer();
  });

  clickyWindow = createClickyWindow(appUrl);

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
        console.log(`[Rearvy] Blocking navigation to ${pathname} in desktop app; redirecting to ${START_PATH}`);
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

      // In packaged releases show a blocking error dialog so end-users see the problem.
      // In development, avoid blocking the main process — log and open DevTools instead
      if (app.isPackaged) {
        dialog.showErrorBox("Rearvy could not open", message);
      } else {
        console.error("[Rearvy] did-fail-load:", message);
        try {
          // Open detached DevTools to help developers inspect renderer errors quickly
          mainWindow?.webContents?.openDevTools?.({ mode: "detach" });
        } catch (e) {
          // Ignore openDevTools failures
        }
      }
    }
  );

  console.log("[Rearvy] Loading Rearvy website desktop app...");

  // Guard against accidental use of the custom protocol as the main app URL.
  // If `getAppUrl()` somehow returns a `rearvy://...` origin (for example
  // when environment variables are misconfigured), fall back to the HTTP
  // dev/packaged URL so the BrowserWindow doesn't try to load the
  // custom-protocol which only provides limited fallback resources.
  let resolvedAppUrl = appUrl;
  try {
    const parsedCandidate = new URL(resolvedAppUrl);
    if (parsedCandidate.protocol === `${APP_PROTOCOL}:`) {
      console.warn(`[Rearvy] App URL uses custom protocol (${resolvedAppUrl}). Falling back to HTTP app URL.`);
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

function createClickyWindow(appUrl) {
  try {
    const clickyUrl = new URL("/clicky", appUrl).toString();
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
      },
    });

    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "screen-saver");

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

    void win.loadURL(clickyUrl).catch((error) => {
      console.error("[Rearvy] Failed to load Clicky window:", error);
    });

    return win;
  } catch (error) {
    console.error("[Rearvy] Failed to create Clicky window:", error);
    return null;
  }
}

app.setAppUserModelId(APP_ID);

// Global shortcut handler for all windows
app.on("browser-window-created", (event, window) => {
  window.webContents.on("before-input-event", (inputEvent, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      window.webContents.toggleDevTools();
      inputEvent.preventDefault();
    }
    // Standard Ctrl+Shift+I alternative
    if (input.type === "keyDown" && input.control && input.shift && input.key.toLowerCase() === "i") {
      window.webContents.toggleDevTools();
      inputEvent.preventDefault();
    }
    // Ctrl+R to reload
    if (input.type === "keyDown" && input.control && input.key.toLowerCase() === "r") {
      window.webContents.reload();
      inputEvent.preventDefault();
    }
  });
});

app.whenReady().then(async () => {
  const { session } = require("electron");
  const cachePath = path.join(app.getPath("userData"), "Cache");
  const projectRoot = path.join(__dirname, "..", "..");

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

  ipcMain.handle("desktop:system:capture-screen", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
      fetchWindowIcons: false,
    });

    const screenSource = sources[0];
    return screenSource ? screenSource.thumbnail.toDataURL() : null;
  });

  // Attempt to list serial ports if serialport (or @serialport/list) is available.
  ipcMain.handle("desktop:device:list-serial-ports", async () => {
    try {
      let listModule = null;

      try {
        listModule = require("@serialport/list");
      } catch (e) {}

      if (!listModule) {
        try {
          // Older serialport versions expose a list() method
          listModule = require("serialport");
        } catch (e) {}
      }

      if (!listModule) {
        return { ok: false, ports: [], message: "serialport not installed" };
      }

      if (typeof listModule.list === "function") {
        const ports = await listModule.list();
        return { ok: true, ports };
      }

      // Some packages export a default function
      if (typeof listModule === "function") {
        const ports = await listModule();
        return { ok: true, ports };
      }

      return { ok: false, ports: [], message: "no list() available" };
    } catch (error) {
      console.error("desktop:device:list-serial-ports failed:", error);
      return { ok: false, ports: [], message: error?.message || String(error) };
    }
  });

  ipcMain.handle("desktop:system:reveal-in-folder", async (event, { filePath }) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  // Receive forwarded console logs from renderer preload and print them in main logs
  ipcMain.on('preload:console', (event, level, message) => {
    try {
      const out = `[Renderer:${level}] ${message}`;
      if (level === 'error' || level === 'warn') {
        console.error(out);
      } else {
        console.log(out);
      }
    } catch (e) {
      console.log('[Renderer] (failed to log forwarded message)');
    }
  });

  ipcMain.handle("desktop:open-devtools", (event) => {
    const webContents = event.sender;
    webContents.openDevTools({ mode: "detach" });

      ipcMain.on("preload:loading", (event) => {
        console.log("[Rearvy] ✓ Preload script loaded successfully");
        ipcMain.on("preload:ready", (event, data) => {
          console.log("[Rearvy] ✓ Preload bridge ready, systemKeys:", data.systemKeys);
        });

      });
    return { success: true };
  });

  ipcMain.on("clicky:set-position", (event, { x, y }) => {
    if (clickyWindow && !clickyWindow.isDestroyed()) {
      clickyWindow.setPosition(Math.round(x), Math.round(y));
    }
  });

  ipcMain.on("clicky:set-size", (event, { width, height }) => {
    if (clickyWindow && !clickyWindow.isDestroyed()) {
      clickyWindow.setContentSize(Math.round(width), Math.round(height));
    }
  });

  ipcMain.handle("clicky:get-mouse-position", () => {
    const { screen } = require("electron");
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
      console.log(`[Rearvy] Attempting to start local API (attempt ${apiStartAttempts}/${maxApiAttempts})...`);
      
      const serverInfo = await startLocalServer();
      localApiPort = serverInfo.port;
      console.log(`[Rearvy] ✓ Local API started successfully on port ${localApiPort}`);
      
      // Notify renderer processes that the local API port is now available
      broadcastLocalApiPort();
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const fullError = error instanceof Error ? error.stack : String(error);
      
      console.error(`[Rearvy] ✗ Failed to start local API (attempt ${apiStartAttempts}/${maxApiAttempts}):`, errorMsg);
      console.error(`[Rearvy] Full error:`, fullError);
      
      if (apiStartAttempts < maxApiAttempts) {
        console.log(`[Rearvy] Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return initializeLocalAPI();
      }
      
      console.error(`[Rearvy] ✗ Failed to start local API after ${maxApiAttempts} attempts`);
      return false;
    }
  }
  
  const apiInitialized = await initializeLocalAPI();
  if (!apiInitialized && mainWindow && !mainWindow.isDestroyed()) {
    console.error("[Rearvy] Local API initialization failed; Automation features will not work");
  }

  const enableBlenderMode = process.env.REARVY_ENABLE_BLENDER === "1";

  if (enableBlenderMode) {
    console.log("[Rearvy] Blender mode enabled, starting Blender MCP bridge...");
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

        startBlenderMcpBridge();
      })
      .catch((err) => {
        console.error("[Rearvy] Error during Blender auto-launch:", err);
        startBlenderMcpBridge();
      });
  } else {
    console.log("[Rearvy] Blender mode is disabled by default. Set REARVY_ENABLE_BLENDER=1 or use npm run desktop:dev:blender when you need Blender tools.");
  }

  console.log("[Rearvy] About to create main window...");
  const websiteStarted = await startLocalWebsiteRuntime(projectRoot);

  let appUrl = getAppUrl();
  console.log(`[Rearvy] App URL resolved to: ${appUrl}, app.isPackaged=${app.isPackaged}, autoStartWebsite=${DESKTOP_AUTO_START_WEBSITE}, websiteStarted=${websiteStarted}`);

  // If we couldn't start the local packaged website runtime in a packaged
  // release, fall back to a remote hosted URL so the BrowserWindow never
  // attempts to load the custom `rearvy://` protocol resources.
  if (websiteStarted === false && app.isPackaged) {
    const remoteFallback =
      process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
      process.env.REARVY_REMOTE_APP_URL ||
      "https://www.rearvy.com";
    process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
    appUrl = getAppUrl();
    console.warn(`[Rearvy] Local website runtime did not start; falling back to remote URL: ${appUrl}`);
  }

  if (shouldWaitForAppUrl(appUrl)) {
    console.log(`[Rearvy] Waiting for app URL to become available: ${appUrl}`);
    let ready = await waitForUrl(appUrl, 60000);
    if (!ready) {
      console.error(`[Rearvy] App URL failed to become available after 60s: ${appUrl}`);
      console.error("[Rearvy] This may indicate the website dev server failed to start.");

      if (app.isPackaged) {
        // Try an automatic remote fallback before showing a blocking dialog.
        try {
          const remoteFallback =
            process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
            process.env.REARVY_REMOTE_APP_URL ||
            "https://www.rearvy.com";

          if (appUrl !== remoteFallback) {
            console.warn(`[Rearvy] Attempting automatic remote fallback to ${remoteFallback}`);
            process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
            appUrl = getAppUrl();
            // Give the remote site a short timeout to become available
            const fallbackReady = await waitForUrl(appUrl, 15000);
            if (fallbackReady) {
              console.log(`[Rearvy] Remote fallback is available: ${appUrl}`);
            } else {
              console.error(`[Rearvy] Remote fallback ${appUrl} not reachable within 15s`);
            }
          }
        } catch (e) {
          console.error("[Rearvy] Remote fallback attempt failed:", e);
        }

        // If remote fallback succeeded, continue startup; otherwise show dialog
        if (shouldWaitForAppUrl(appUrl)) {
          ready = await waitForUrl(appUrl, 1000);
          if (ready) {
            console.log(`[Rearvy] Proceeding with remote fallback URL: ${appUrl}`);
          }
        }

        if (!ready) {
          try {
            const result = await dialog.showMessageBox({
              type: "error",
              title: "Rearvy could not open",
              message: `Rearvy could not load ${appUrl}`,
              detail:
                "The website server did not start.\n\n" +
                "Try:\n" +
                "1. Click 'Retry' to restart the server\n" +
                "2. Check your internet connection\n" +
                "3. Restart Rearvy if the problem persists\n\n" +
                "For help, see rearvy.com or check the application logs.",
              buttons: ["Retry", "Open in browser", "Cancel"],
              defaultId: 0,
              cancelId: 2,
            });

            if (result.response === 0) {
              console.log("[Rearvy] User selected Retry — attempting to start website runtime again...");
              try {
                const retryStarted = await startLocalWebsiteRuntime(projectRoot);
                if (retryStarted) {
                  appUrl = getAppUrl();
                  ready = await waitForUrl(appUrl, 60000);
                } else {
                  console.error("[Rearvy] Retry failed to start local website runtime; will open remote fallback in external browser.");
                  const remoteFallback =
                    process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
                    process.env.REARVY_REMOTE_APP_URL ||
                    "https://www.rearvy.com";
                  process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
                  appUrl = getAppUrl();
                  try {
                    await shell.openExternal(appUrl);
                  } catch (e) {
                    console.error("Failed to open external browser:", e);
                  }
                }
              } catch (e) {
                console.error("[Rearvy] startLocalWebsiteRuntime failed during retry:", e);
              }

              if (!ready) {
                console.error("[Rearvy] Retry also failed — opening in external browser as fallback.");
                try {
                  await shell.openExternal(appUrl);
                } catch (e) {
                  console.error("Failed to open external browser:", e);
                }
              }
            } else if (result.response === 1) {
              try {
                await shell.openExternal(appUrl);
              } catch (e) {
                console.error("Failed to open external browser:", e);
              }
            } else {
              console.log("[Rearvy] User cancelled startup; quitting application.");
              app.quit();
              return;
            }
          } catch (e) {
            console.error("[Rearvy] Failed to show fallback dialog:", e);
          }
        }
      } else {
        if (process.env.REARVY_DESKTOP_AUTO_OPEN_BROWSER === "1") {
          try {
            await shell.openExternal(appUrl);
          } catch (e) {
            console.error("Failed to open external browser:", e);
          }
        }
      }
    } else {
      console.log(`[Rearvy] App URL is now available: ${appUrl}`);
    }
  }

  createMainWindow();
  setupClickyLogic(mainWindow, clickyWindow);
  setupTerminalIPC(ipcMain, mainWindow);
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
