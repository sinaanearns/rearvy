/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  onAuthToken: (callback) => ipcRenderer.on("auth-token", (_event, token) => callback(token)),
});
