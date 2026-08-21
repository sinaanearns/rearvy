"use strict";

const { ipcMain, app, BrowserWindow } = require("electron");
const { createLogger } = require("./logger.cjs");
const {
  captureDeviceProfile,
  readDeviceProfileSnapshot,
  writeDeviceProfileSnapshot,
  DESKTOP_PROBE_TARGETS,
} = require("./device-profile.cjs");

const log = createLogger("DeviceProfileIpc");

const CHANNEL_CAPTURE = "desktop:device-profile:capture";
const CHANNEL_GET = "desktop:device-profile:get";
const CHANNEL_SAVE = "desktop:device-profile:save";
const CHANNEL_PUSH = "desktop:device-profile:updated";

function defaultPath() {
  try {
    if (app && typeof app.getPath === "function") {
      return require("node:path").join(app.getPath("userData"), "device-profile.json");
    }
  } catch (error) {
    void error;
  }
  return null;
}

function isString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function broadcastToRenderers(payload) {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(CHANNEL_PUSH, payload);
      }
    }
  } catch (error) {
    log.debug("Failed to broadcast device profile update:", error?.message || error);
  }
}

/**
 * Resolves the website API base URL from environment or the local-server port.
 * Falls back to the production URL if neither is available.
 */
function resolveApiBaseUrl(options = {}) {
  // Option 1: explicitly provided
  if (isString(options.apiBaseUrl)) return options.apiBaseUrl;

  // Option 2: next dev server
  const nextPort = process.env.REARVY_WEBSITE_PORT || process.env.PORT || "3000";
  const host = process.env.REARVY_WEBSITE_HOST || "localhost";
  return `http://${host}:${nextPort}`;
}

function setupDeviceProfileIpc(ipcMainRef, options = {}) {
  if (!ipcMainRef || typeof ipcMainRef.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register device profile IPC.");
  }

  const trusted = typeof options.isTrustedSender === "function" ? options.isTrustedSender : null;

  function assertTrusted(event) {
    if (!trusted || trusted(event)) return;
    throw new Error("Device profile request rejected from an untrusted renderer.");
  }

  ipcMainRef.handle(CHANNEL_GET, async (event) => {
    assertTrusted(event);
    const snapshot = await readDeviceProfileSnapshot(defaultPath() || "device-profile.json");
    return { snapshot: snapshot || null };
  });

  ipcMainRef.handle(CHANNEL_SAVE, async (event, payload) => {
    assertTrusted(event);
    if (!payload || typeof payload !== "object") {
      throw new Error("Device profile payload is required.");
    }
    const filePath = isString(payload.filePath) ? payload.filePath : defaultPath();
    if (!filePath) {
      throw new Error("Device profile file path could not be resolved.");
    }
    await writeDeviceProfileSnapshot(filePath, payload.snapshot || {});
    return { ok: true };
  });

  ipcMainRef.handle(CHANNEL_CAPTURE, async (event, captureOptions) => {
    assertTrusted(event);

    // Broadcast progress start to renderers so the UI can show a spinner
    broadcastToRenderers({ status: "scanning", capturedAt: new Date().toISOString() });

    // The renderer may pass { authToken } so we can call the AI classification API
    const authToken = captureOptions?.authToken || options.defaultAuthToken || "";
    const apiBaseUrl = resolveApiBaseUrl(options);

    const result = await captureDeviceProfile({
      apiBaseUrl,
      authToken,
    });

    const payload = {
      snapshot: result.snapshot,
      filePath: result.filePath,
      capturedAt: new Date().toISOString(),
      status: "done",
    };

    broadcastToRenderers(payload);
    return { snapshot: result.snapshot, filePath: result.filePath };
  });
}

module.exports = {
  setupDeviceProfileIpc,
  DESKTOP_PROBE_TARGETS,
  DEVICE_PROFILE_CHANNELS: {
    capture: CHANNEL_CAPTURE,
    get: CHANNEL_GET,
    save: CHANNEL_SAVE,
    push: CHANNEL_PUSH,
  },
};
