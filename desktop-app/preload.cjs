/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
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
});
