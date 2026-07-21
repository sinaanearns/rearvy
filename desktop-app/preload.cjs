const { contextBridge, ipcRenderer } = require("electron");

const BRIDGE_VERSION = "2026.06.04.1";
const PRELOAD_LOG_LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function normalizePreloadLogLevel(value) {
  const level = String(value || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(PRELOAD_LOG_LEVELS, level) ? level : null;
}

const preloadEnv = typeof process !== "undefined" && process?.env ? process.env : {};
const preloadLogLevel =
  normalizePreloadLogLevel(preloadEnv.REARVY_LOG_LEVEL) ||
  (preloadEnv.NODE_ENV === "production" ? "warn" : "info");

function createPreloadLogger(scope = "") {
  const prefix = scope ? `[${scope}]` : "";

  function write(method, level, args) {
    if (PRELOAD_LOG_LEVELS[level] > PRELOAD_LOG_LEVELS[preloadLogLevel]) {
      return;
    }

    if (prefix) {
      console[method](prefix, ...args);
      return;
    }

    console[method](...args);
  }

  return {
    error: (...args) => write("error", "error", args),
    warn: (...args) => write("warn", "warn", args),
    info: (...args) => write("log", "info", args),
    debug: (...args) => write("log", "debug", args),
  };
}

const log = createPreloadLogger("Preload");
const EXPOSED_ELECTRON_KEYS = [
  "getCapabilities",
  "workspace",
  "file",
  "clipboard",
  "notifications",
  "system",
  "browser",
  "updater",
  "automation",
  "terminal",
  "maria",
  "device",
  "agentDesktop",
];
const EXPOSED_SYSTEM_KEYS = ["openExternal", "revealInFolder", "captureScreen", "openDevTools"];

// Signal to main process that preload is loading
ipcRenderer.send("preload:loading");

log.debug("Preload script starting...");
log.debug("contextBridge available:", typeof contextBridge);
log.debug("ipcRenderer available:", typeof ipcRenderer);

contextBridge.exposeInMainWorld("electron", {
  getCapabilities: async () => {
    const mainCapabilities = await ipcRenderer.invoke("desktop:get-capabilities").catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));

    return {
      ...mainCapabilities,
      bridgeVersion: mainCapabilities?.bridgeVersion || BRIDGE_VERSION,
      rendererBridgeVersion: BRIDGE_VERSION,
      renderer: {
        terminal: true,
        localApiPort: true,
        device: true,
        automation: true,
        maria: true,
        browser: true,
      },
    };
  },
  onAuthCredential: (callback) => {
    const listener = (_event, credential) => callback(credential);
    ipcRenderer.on("auth-credential", listener);
    return () => ipcRenderer.removeListener("auth-credential", listener);
  },
  sendAuthCredential: (credential) => {
    ipcRenderer.send("auth-credential", credential);
  },
  onAuthToken: (callback) => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on("auth-token", listener);
    return () => ipcRenderer.removeListener("auth-token", listener);
  },
  sendAuthToken: (token) => {
    ipcRenderer.send("auth-token", token);
  },
  onOpenPath: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:open-path", listener);
    return () => ipcRenderer.removeListener("desktop:open-path", listener);
  },
  onDesktopMcpConfig: (callback) => {
    const listener = (_event, config) => callback(config);
    ipcRenderer.on("desktop-mcp-config", listener);
    return () => ipcRenderer.removeListener("desktop-mcp-config", listener);
  },
  requestDesktopMcpConfig: () => ipcRenderer.invoke("desktop-mcp-config"),
  localApiPort: () => ipcRenderer.invoke("desktop:local-api-port"),
  onLocalApiPort: (callback) => {
    const listener = (_event, port) => callback(port);
    ipcRenderer.on("desktop:local-api-port", listener);
    return () => ipcRenderer.removeListener("desktop:local-api-port", listener);
  },
  workspace: {
    getScope: () => ipcRenderer.invoke("desktop:workspace:get-scope"),
    setScope: (scope) => ipcRenderer.invoke("desktop:workspace:set-scope", scope),
    useSandbox: () => ipcRenderer.invoke("desktop:workspace:use-sandbox"),
    pickFolder: () => ipcRenderer.invoke("desktop:workspace:pick-folder"),
  },
  file: {
    pickOpenPath: (filters) =>
      ipcRenderer.invoke("desktop:file:pick-open", { filters }),
    readText: (filePath) =>
      ipcRenderer.invoke("desktop:file:read-text", { filePath }),
    pickSavePath: (defaultPath, filters) =>
      ipcRenderer.invoke("desktop:file:pick-save", { defaultPath, filters }),
    writeText: (filePath, content) =>
      ipcRenderer.invoke("desktop:file:write-text", { filePath, content }),
  },
  clipboard: {
    readText: () => ipcRenderer.invoke("desktop:clipboard:read-text"),
    writeText: (text) =>
      ipcRenderer.invoke("desktop:clipboard:write-text", { text }),
  },
  notifications: {
    show: (title, body) =>
      ipcRenderer.invoke("desktop:notification:show", { title, body }),
  },
  system: {
    openExternal: (url) =>
      ipcRenderer.invoke("desktop:system:open-external", { url }),
    revealInFolder: (filePath) =>
      ipcRenderer.invoke("desktop:system:reveal-in-folder", { filePath }),
    captureScreen: () => ipcRenderer.invoke("desktop:system:capture-screen"),
    openDevTools: () => ipcRenderer.invoke("desktop:open-devtools"),
  },
  browser: {
    getConnectionStatus: () =>
      ipcRenderer.invoke("desktop:browser:get-connection-status"),
    openBrowserInternalUrl: (url) =>
      ipcRenderer.invoke("desktop:browser:open-browser-url", { url }),
    openChromeInternalUrl: (url) =>
      ipcRenderer.invoke("desktop:browser:open-chrome-url", { url }),
    openExtensionOptions: (options) =>
      ipcRenderer.invoke("desktop:browser:open-extension-options", options || {}),
    openExtensionFolder: () =>
      ipcRenderer.invoke("desktop:browser:open-extension-folder"),
    copyExtensionPath: () =>
      ipcRenderer.invoke("desktop:browser:copy-extension-path"),
    createRelayPairingCode: () =>
      ipcRenderer.invoke("desktop:browser:create-relay-pairing-code"),
    getRelayInfo: () =>
      ipcRenderer.invoke("desktop:browser:get-relay-info"),
  },
  updater: {
    getState: () => ipcRenderer.invoke("desktop:update:get-state"),
    checkForUpdates: () => ipcRenderer.invoke("desktop:update:check"),
    downloadUpdate: () => ipcRenderer.invoke("desktop:update:download"),
    installAndRestart: () => ipcRenderer.invoke("desktop:update:install"),
    onStateChange: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("desktop:update:state", listener);
      return () => ipcRenderer.removeListener("desktop:update:state", listener);
    },
  },
  // FLERB AI Desktop Automation
  automation: {
    startWorkflow: (workflow) =>
      ipcRenderer.invoke("desktop:automation:start-workflow", workflow),
    approveWorkflow: (workflowId) =>
      ipcRenderer.invoke("desktop:automation:approve-workflow", workflowId),
    rejectWorkflow: (workflowId, reason) =>
      ipcRenderer.invoke("desktop:automation:reject-workflow", workflowId, reason),
    getState: () => ipcRenderer.invoke("desktop:automation:get-state"),
    pause: () => ipcRenderer.invoke("desktop:automation:pause"),
    resume: () => ipcRenderer.invoke("desktop:automation:resume"),
    stop: () => ipcRenderer.invoke("desktop:automation:stop"),
    getHistory: (workflowId) =>
      ipcRenderer.invoke("desktop:automation:get-history", workflowId),
    runTest: () => ipcRenderer.invoke("desktop:automation:test"),
    checkAppInstalled: (appPath) =>
      ipcRenderer.invoke("desktop:automation:check-app-installed", { appPath }),
    onStateChange: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("desktop:automation:state-change", listener);
      return () => ipcRenderer.removeListener("desktop:automation:state-change", listener);
    },
    onPaused: (callback) => {
      const listener = (_event) => callback();
      ipcRenderer.on("desktop:automation:paused", listener);
      return () => ipcRenderer.removeListener("desktop:automation:paused", listener);
    },
    onResumed: (callback) => {
      const listener = (_event) => callback();
      ipcRenderer.on("desktop:automation:resumed", listener);
      return () => ipcRenderer.removeListener("desktop:automation:resumed", listener);
    },
    onStopped: (callback) => {
      const listener = (_event) => callback();
      ipcRenderer.on("desktop:automation:stopped", listener);
      return () => ipcRenderer.removeListener("desktop:automation:stopped", listener);
    },
  },
  terminal: {
    runCommand: (options) => ipcRenderer.invoke("desktop:terminal:run", options),
    stopProcess: (processId) => ipcRenderer.invoke("desktop:terminal:stop", processId),
    openExternal: (path) => ipcRenderer.invoke("desktop:terminal:open-external", path),
    onOutput: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("desktop:terminal:output", listener);
      return () => ipcRenderer.removeListener("desktop:terminal:output", listener);
    },
    onStatusChange: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("desktop:terminal:status", listener);
      return () => ipcRenderer.removeListener("desktop:terminal:status", listener);
    }
  },
  maria: {
    setPosition: (x, y) => ipcRenderer.send("maria:set-position", { x, y }),
    setSize: (width, height) => ipcRenderer.send("maria:set-size", { width, height }),
    setInteractiveRegions: (regions) => ipcRenderer.send("maria:set-interactive-regions", regions),
    setMousePassthrough: (passthrough) => ipcRenderer.send("maria:set-mouse-passthrough", Boolean(passthrough)),
    getMousePosition: () => ipcRenderer.invoke("maria:get-mouse-position"),
    getReadiness: () => ipcRenderer.invoke("maria:get-readiness"),
    runCommand: (command) => ipcRenderer.invoke("maria:command", command),
    research: (command) => ipcRenderer.invoke("maria:research", command),
    stop: () => ipcRenderer.invoke("maria:stop"),
    wakeDetected: (payload) => ipcRenderer.send("maria:wake-detected", payload || {}),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("maria:status", listener);
      return () => ipcRenderer.removeListener("maria:status", listener);
    },
    onAssistantEvent: (callback) => {
      const listener = (_event, event) => callback(event);
      ipcRenderer.on("maria:assistant-event", listener);
      return () => ipcRenderer.removeListener("maria:assistant-event", listener);
    },
    // Calls & Meetings
    startCall: (params) => ipcRenderer.invoke("maria:call:initiate", params),
    stopCall: (sessionId) => ipcRenderer.invoke("maria:call:stop", sessionId),
    getCallStatus: (sessionId) => ipcRenderer.invoke("maria:call:status", sessionId),
    joinMeeting: (meetingInfo) => ipcRenderer.invoke("maria:meeting:join", meetingInfo),
    onCallEvent: (callback) => {
      const listener = (_event, ev) => callback(ev);
      ipcRenderer.on("maria:call-event", listener);
      return () => ipcRenderer.removeListener("maria:call-event", listener);
    },
  },
  device: {
    listSerialPorts: () => ipcRenderer.invoke("desktop:device:list-serial-ports"),
  },

  // ── agent-desktop ──────────────────────────────────────────────────────
  // Exposes the full agent-desktop CLI surface to the renderer.
  // Available as window.electron.agentDesktop.*
  agentDesktop: {
    // Core / escape-hatch
    runCommand: (args, opts) => ipcRenderer.invoke("desktop:agent:run-command", args, opts),
    health: () => ipcRenderer.invoke("desktop:agent:health"),
    status: () => ipcRenderer.invoke("desktop:agent:status"),
    permissions: () => ipcRenderer.invoke("desktop:agent:permissions"),
    version: () => ipcRenderer.invoke("desktop:agent:version"),

    // Observation
    snapshot: (app, opts) => ipcRenderer.invoke("desktop:agent:snapshot", app, opts),
    find: (filter, opts) => ipcRenderer.invoke("desktop:agent:find", filter, opts),
    screenshot: (opts) => ipcRenderer.invoke("desktop:agent:screenshot", opts),

    // Interaction
    click: (refId, snapshotId, opts) => ipcRenderer.invoke("desktop:agent:click", refId, snapshotId, opts),
    type: (refId, text, snapshotId, opts) => ipcRenderer.invoke("desktop:agent:type", refId, text, snapshotId, opts),
    press: (combo, opts) => ipcRenderer.invoke("desktop:agent:press", combo, opts),
    scroll: (refId, direction, amount, snapshotId, opts) =>
      ipcRenderer.invoke("desktop:agent:scroll", refId, direction, amount, snapshotId, opts),
    wait: (condition, opts) => ipcRenderer.invoke("desktop:agent:wait", condition, opts),

    // Mouse
    mouseMove: (x, y, opts) => ipcRenderer.invoke("desktop:agent:mouse-move", x, y, opts),
    mouseClick: (x, y, opts) => ipcRenderer.invoke("desktop:agent:mouse-click", x, y, opts),
    mouseWheel: (x, y, dx, dy, opts) => ipcRenderer.invoke("desktop:agent:mouse-wheel", x, y, dx, dy, opts),
    drag: (from, to, opts) => ipcRenderer.invoke("desktop:agent:drag", from, to, opts),
    hover: (refOrXy, opts) => ipcRenderer.invoke("desktop:agent:hover", refOrXy, opts),

    // Clipboard
    clipboardGet: (opts) => ipcRenderer.invoke("desktop:agent:clipboard-get", opts),
    clipboardSet: (text, opts) => ipcRenderer.invoke("desktop:agent:clipboard-set", text, opts),
    clipboardClear: (opts) => ipcRenderer.invoke("desktop:agent:clipboard-clear", opts),

    // Window / App
    listWindows: (filter, opts) => ipcRenderer.invoke("desktop:agent:list-windows", filter, opts),
    listApps: (appFilter, opts) => ipcRenderer.invoke("desktop:agent:list-apps", appFilter, opts),
    listDisplays: (opts) => ipcRenderer.invoke("desktop:agent:list-displays", opts),
    focusWindow: (target, opts) => ipcRenderer.invoke("desktop:agent:focus-window", target, opts),
    launch: (appName, opts) => ipcRenderer.invoke("desktop:agent:launch", appName, opts),
    closeApp: (appName, force, opts) => ipcRenderer.invoke("desktop:agent:close-app", appName, force, opts),

    // Session
    sessionStart: (name, screenshots) => ipcRenderer.invoke("desktop:agent:session-start", name, screenshots),
    sessionEnd: (sessionId) => ipcRenderer.invoke("desktop:agent:session-end", sessionId),
    sessionList: () => ipcRenderer.invoke("desktop:agent:session-list"),
    sessionGc: () => ipcRenderer.invoke("desktop:agent:session-gc"),

    // Trace
    traceShow: (sessionId, limit) => ipcRenderer.invoke("desktop:agent:trace-show", sessionId, limit),
    traceExport: (sessionId, out) => ipcRenderer.invoke("desktop:agent:trace-export", sessionId, out),

    // Batch
    batch: (commands, opts) => ipcRenderer.invoke("desktop:agent:batch", commands, opts),
  },
});

function announceBridgeReady() {
  try {
    const detail = {
      keys: EXPOSED_ELECTRON_KEYS,
      hasTerminal: true,
      hasSystem: true,
      systemKeys: EXPOSED_SYSTEM_KEYS,
    };

    window.dispatchEvent(new CustomEvent("rearvy-electron-ready", { detail }));
  } catch (error) {
    log.error("Failed to announce bridge readiness:", error);
  }
}

function schedulePreloadTask(callback) {
  const run = () => {
    try {
      callback();
    } catch (error) {
      log.error("Deferred preload task failed:", error);
    }
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(run);
    return;
  }

  if (typeof Promise === "function") {
    Promise.resolve().then(run);
    return;
  }

  setTimeout(run, 0);
}

log.debug("Electron bridge exposed successfully");

// Check if the bridge is accessible to window after the sandbox exposes it.
schedulePreloadTask(() => {
  log.debug("Main-world electron bridge exposed:", true);
  log.debug("Main-world electron.system exposed:", true);
  log.debug("Main-world electron.system.openDevTools exposed:", true);

  // Signal to main process that bridge is ready
  ipcRenderer.send("preload:ready", {
    hasElectron: "object",
    hasSystem: "object",
    hasOpenDevTools: "function",
    systemKeys: EXPOSED_SYSTEM_KEYS,
  });

  announceBridgeReady();
});

setTimeout(() => {
  announceBridgeReady();
}, 1000);

// Mark the bridge as ready
window.__electronReady = true;

setTimeout(() => {
  try {
    const keys = EXPOSED_ELECTRON_KEYS;
    log.debug("Exposed electron keys:", keys);
    const availability = keys.reduce((acc, k) => {
      acc[k] = true;
      return acc;
    }, {});
    log.debug("Electron key availability:", availability);
  } catch (err) {
    log.error("Runtime debug failed:", err);
  }
}, 500);

function redactConsoleMessage(value) {
  return String(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(
      /\b(authorization|idToken|accessToken|refreshToken|apiKey|api_key|secret|password|token)(["']?\s*[:=]\s*["']?)([^"',}\s]+)/gi,
      "$1$2[redacted]"
    );
}

function safeRedactConsoleValue(value) {
  try {
    if (typeof value === "string") {
      return redactConsoleMessage(value);
    }

    return redactConsoleMessage(JSON.stringify(value));
  } catch (error) {
    log.debug("Could not serialize renderer console value:", error?.message || error);
    return "<unserializable>";
  }
}

// Forward renderer console messages to the main process to aid debugging
(function forwardConsole() {
  try {
    const levels = ["log", "info", "warn", "error", "debug"];
    for (const level of levels) {
      const original = console[level] && console[level].bind(console);
      console[level] = function (...args) {
        try {
          const serialized = args.map(safeRedactConsoleValue).join(' ');
          ipcRenderer.send('preload:console', level, serialized);
        } catch (e) {
          // ignore
        }
        if (original) original(...args);
      };
    }
  } catch (e) {
    // best-effort only
  }
})();
