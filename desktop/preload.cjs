const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  onAuthToken: (callback) => ipcRenderer.on("auth-token", (_event, token) => callback(token)),
});
