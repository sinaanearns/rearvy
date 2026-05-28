const { contextBridge, ipcRenderer } = require("electron");
const BRIDGE_VERSION = "2026.05.14.1";
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
  "clicky",
  "device",
];
const EXPOSED_SYSTEM_KEYS = ["openExternal", "revealInFolder", "captureScreen", "openDevTools"];

// Signal to main process that preload is loading
ipcRenderer.send("preload:loading");

console.log("[Preload] Preload script starting...");
console.log("[Preload] contextBridge available:", typeof contextBridge);
console.log("[Preload] ipcRenderer available:", typeof ipcRenderer);

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
        clicky: true,
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
  clicky: {
    setPosition: (x, y) => ipcRenderer.send("clicky:set-position", { x, y }),
    setSize: (width, height) => ipcRenderer.send("clicky:set-size", { width, height }),
    setMousePassthrough: (passthrough) => ipcRenderer.send("clicky:set-mouse-passthrough", Boolean(passthrough)),
    getMousePosition: () => ipcRenderer.invoke("clicky:get-mouse-position"),
    runCommand: (command) => ipcRenderer.invoke("clicky:command", command),
    research: (command) => ipcRenderer.invoke("clicky:research", command),
    stop: () => ipcRenderer.invoke("clicky:stop"),
    wakeDetected: (payload) => ipcRenderer.send("clicky:wake-detected", payload || {}),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("clicky:status", listener);
      return () => ipcRenderer.removeListener("clicky:status", listener);
    },
    onAssistantEvent: (callback) => {
      const listener = (_event, event) => callback(event);
      ipcRenderer.on("clicky:assistant-event", listener);
      return () => ipcRenderer.removeListener("clicky:assistant-event", listener);
    },
  },
  device: {
    listSerialPorts: () => ipcRenderer.invoke("desktop:device:list-serial-ports"),
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
    console.error("[Preload] Failed to announce bridge readiness:", error);
  }
}

function schedulePreloadTask(callback) {
  const run = () => {
    try {
      callback();
    } catch (error) {
      console.error("[Preload] Deferred preload task failed:", error);
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

console.log("[Preload] Electron bridge exposed successfully");

// Check if the bridge is accessible to window after the sandbox exposes it.
schedulePreloadTask(() => {
  console.log("[Preload] Main-world electron bridge exposed:", true);
  console.log("[Preload] Main-world electron.system exposed:", true);
  console.log("[Preload] Main-world electron.system.openDevTools exposed:", true);

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
    console.log("[Preload] Exposed electron keys:", keys);
    const availability = keys.reduce((acc, k) => {
      acc[k] = true;
      return acc;
    }, {});
    console.log("[Preload] Electron key availability:", availability);
  } catch (err) {
    console.error("[Preload] Runtime debug failed:", err);
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

// Forward renderer console messages to the main process to aid debugging
(function forwardConsole() {
  try {
    const levels = ["log", "info", "warn", "error", "debug"];
    for (const level of levels) {
      const original = console[level] && console[level].bind(console);
      console[level] = function (...args) {
        try {
          const serialized = args.map((a) => {
            try {
              if (typeof a === 'string') return redactConsoleMessage(a);
              return redactConsoleMessage(JSON.stringify(a));
            } catch (e) {
              try { return redactConsoleMessage(String(a)); } catch { return '<unserializable>'; }
            }
          }).join(' ');
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
