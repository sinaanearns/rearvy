"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "desktop-app", "preload.cjs");
let content = fs.readFileSync(target, "utf8");

const oldList = [
  "const EXPOSED_ELECTRON_KEYS = [",
  '  "getCapabilities",',
  '  "workspace",',
  '  "file",',
  '  "clipboard",',
  '  "notifications",',
  '  "system",',
  '  "browser",',
  '  "updater",',
  '  "automation",',
  '  "terminal",',
  '  "maria",',
  '  "device",',
  '  "agentDesktop",',
  "];"
].join("\n");

const newList = [
  "const EXPOSED_ELECTRON_KEYS = [",
  '  "getCapabilities",',
  '  "workspace",',
  '  "file",',
  '  "clipboard",',
  '  "notifications",',
  '  "system",',
  '  "browser",',
  '  "updater",',
  '  "automation",',
  '  "terminal",',
  '  "maria",',
  '  "device",',
  '  "agentDesktop",',
  '  "deviceProfile",',
  "];"
].join("\n");

if (content.includes(oldList)) {
  content = content.replace(oldList, newList);
  console.log("Patched EXPOSED_ELECTRON_KEYS list");
} else {
  console.log("EXPOSED_ELECTRON_KEYS list already up-to-date");
}

const newBlock = [
  "  deviceProfile: {",
  "    capture: () => ipcRenderer.invoke(\"desktop:device-profile:capture\"),",
  "    get: () => ipcRenderer.invoke(\"desktop:device-profile:get\"),",
  "    save: (payload) => ipcRenderer.invoke(\"desktop:device-profile:save\", payload),",
  "    onUpdated: (callback) => {",
  "      const listener = (_event, payload) => callback(payload);",
  "      ipcRenderer.on(\"desktop:device-profile:updated\", listener);",
  "      return () => ipcRenderer.removeListener(\"desktop:device-profile:updated\", listener);",
  "    },",
  "  },"
].join("\n");

if (content.includes("deviceProfile:")) {
  console.log("deviceProfile surface already present; skipping insertion");
} else {
  const marker = "  device: {";
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Could not find device surface to insert deviceProfile block");
  }
  const insertAt = content.lastIndexOf("\n", markerIndex) + 1;
  const before = content.slice(0, insertAt);
  const after = content.slice(insertAt);
  content = `${before}${newBlock}\n${after}`;
  console.log("Inserted deviceProfile surface");
}

fs.writeFileSync(target, content);
console.log("Wrote preload.cjs");
