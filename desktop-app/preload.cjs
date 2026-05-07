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
});
