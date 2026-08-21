"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "desktop-app", "main.cjs");
let content = fs.readFileSync(target, "utf8");

if (!content.includes("require(\"./lib/device-profile-ipc.cjs\")")) {
  const marker = "const { setupAgentDesktopIPC } = require(\"./lib/agent-desktop-ipc.cjs\");";
  const insertion = marker + "\nconst { setupDeviceProfileIpc } = require(\"./lib/device-profile-ipc.cjs\");";
  if (!content.includes(marker)) {
    throw new Error("Could not find setupAgentDesktopIPC require line to insert device-profile IPC");
  }
  content = content.replace(marker, insertion);
  console.log("Inserted setupDeviceProfileIpc import");
} else {
  console.log("setupDeviceProfileIpc import already present");
}

if (!content.includes("setupDeviceProfileIpc(ipcMain")) {
  const marker = "setupAgentDesktopIPC(ipcMain, {";
  if (!content.includes(marker)) {
    throw new Error("Could not find setupAgentDesktopIPC call to insert device-profile registration");
  }
  const trustBlock = marker + "\n    isTrustedSender: (event) => {\n      const senderUrl = event?.sender?.getURL?.() || \"\";\n      try {\n        return isTrustedDesktopOrigin(new URL(senderUrl).origin);\n      } catch {\n        return false;\n      }\n    },\n  });";
  // We need to find the closing of the setupAgentDesktopIPC call. Easiest: search for
  // the next line that closes it: "  });" right after the call.
  const idx = content.indexOf(marker);
  // The agent IPC call ends at the next "  });" after the marker
  const endIdx = content.indexOf("  });", idx);
  if (endIdx === -1) {
    throw new Error("Could not find end of setupAgentDesktopIPC call");
  }
  const closeIdx = endIdx + "  });".length;
  const callText = content.slice(idx, closeIdx);
  // Replace the call with the same call but add a sibling setupDeviceProfileIpc call.
  const replacement = callText + "\n  setupDeviceProfileIpc(ipcMain, {\n    isTrustedSender: (event) => {\n      const senderUrl = event?.sender?.getURL?.() || \"\";\n      try {\n        return isTrustedDesktopOrigin(new URL(senderUrl).origin);\n      } catch {\n        return false;\n      }\n    },\n  });";
  content = content.slice(0, idx) + replacement + content.slice(closeIdx);
  console.log("Inserted setupDeviceProfileIpc call after setupAgentDesktopIPC");
} else {
  console.log("setupDeviceProfileIpc call already present");
}

if (!content.includes("void captureInitialDeviceProfile")) {
  const marker = "  setupAgentDesktopIPC(ipcMain, {";
  const idx = content.indexOf(marker);
  if (idx === -1) {
    throw new Error("Could not find setupAgentDesktopIPC call to schedule device profile capture");
  }
  const insertion = [
    "",
    "  void captureInitialDeviceProfile().catch((error) =>",
    "    log.warn(\"[Rearvy] Initial device profile capture failed:\", error?.message || error)",
    "  );",
    ""
  ].join("\n");
  content = content.slice(0, idx) + insertion + content.slice(idx);
  console.log("Inserted captureInitialDeviceProfile call");
} else {
  console.log("captureInitialDeviceProfile call already present");
}

const helper = [
  "async function captureInitialDeviceProfile() {",
  "  try {",
  "    const { captureDeviceProfile } = require(\"./lib/device-profile.cjs\");",
  "    const result = await captureDeviceProfile();",
  "    if (mainWindow && !mainWindow.isDestroyed()) {",
  "      mainWindow.webContents.send(\"desktop:device-profile:updated\", {",
  "        snapshot: result.snapshot,",
  "        filePath: result.filePath,",
  "        capturedAt: new Date().toISOString(),",
  "      });",
  "    }",
  "  } catch (error) {",
  "    log.warn(\"[Rearvy] Device profile capture failed:\", error?.message || error);",
  "  }",
  "}",
  ""
].join("\n");

if (!content.includes("async function captureInitialDeviceProfile")) {
  const marker = "ipcMain.handle(\"desktop:browser:get-connection-status\"";
  if (!content.includes(marker)) {
    throw new Error("Could not find marker for captureInitialDeviceProfile helper");
  }
  const idx = content.lastIndexOf("\n", content.indexOf(marker));
  content = content.slice(0, idx) + "\n" + helper + content.slice(idx);
  console.log("Inserted captureInitialDeviceProfile helper");
} else {
  console.log("captureInitialDeviceProfile helper already present");
}

fs.writeFileSync(target, content);
console.log("Wrote main.cjs");
