/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");
const BRIDGE_VERSION = "2026.05.14.1";

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
    getMousePosition: () => ipcRenderer.invoke("clicky:get-mouse-position"),
    runCommand: (command) => ipcRenderer.invoke("clicky:command", command),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("clicky:status", listener);
      return () => ipcRenderer.removeListener("clicky:status", listener);
    },
  },
  device: {
    listSerialPorts: () => ipcRenderer.invoke("desktop:device:list-serial-ports"),
  },
});

function announceBridgeReady() {
  try {
    const detail = {
      keys: Object.keys(window.electron || {}),
      hasTerminal: !!window.electron?.terminal,
      hasSystem: !!window.electron?.system,
    };

    window.dispatchEvent(new CustomEvent("rearvy-electron-ready", { detail }));
  } catch (error) {
    console.error("[Preload] Failed to announce bridge readiness:", error);
  }
}

console.log("[Preload] Electron bridge exposed successfully");

// Check if the bridge is accessible to window
process.nextTick(() => {
  console.log("[Preload] After nextTick - window.electron available:", typeof window.electron);
  console.log("[Preload] After nextTick - window.electron.system available:", typeof (window.electron?.system));
  console.log("[Preload] After nextTick - window.electron.system.openDevTools available:", typeof (window.electron?.system?.openDevTools));

// Signal to main process that bridge is ready
ipcRenderer.send("preload:ready", {
  hasElectron: typeof window.electron,
  hasSystem: typeof (window.electron?.system),
  hasOpenDevTools: typeof (window.electron?.system?.openDevTools),
  systemKeys: Object.keys(window.electron?.system || {}),
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
    const keys = Object.keys(window.electron || {});
    console.log("[Preload] Exposed electron keys:", keys);
    const availability = keys.reduce((acc, k) => {
      try {
        acc[k] = typeof window.electron[k] !== "undefined";
      } catch (e) {
        acc[k] = false;
      }
      return acc;
    }, {});
    console.log("[Preload] Electron key availability:", availability);
  } catch (err) {
    console.error("[Preload] Runtime debug failed:", err);
  }
}, 500);
