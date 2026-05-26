const express = require("express");
const { spawn } = require("child_process");
const { clipboard, shell, app } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_RELAY_PORT = Number(process.env.REARVY_BROWSER_RELAY_PORT || 48732);
const DEFAULT_CDP_PORT = Number(process.env.REARVY_BROWSER_CDP_PORT || 9222);
const COMMAND_TTL_MS = 5 * 60 * 1000;

let server = null;
let serverPort = null;
let startPromise = null;
let pairingCode = null;
let pairingExpiresAt = 0;
let pairedExtensionId = null;
let extensionState = {
  connected: false,
  id: null,
  version: null,
  tabCount: 0,
  tabs: [],
  lastSeenAt: null,
};
const commandQueue = [];
const commands = new Map();

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makePairingCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function cleanOldCommands() {
  const now = Date.now();
  for (const [id, command] of commands.entries()) {
    if (now - command.createdAt > COMMAND_TTL_MS) {
      commands.delete(id);
    }
  }
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getExtensionRoot() {
  const candidates = [
    path.join(process.resourcesPath || "", "chrome-extension", "rearvy-browser-relay"),
    path.join(__dirname, "..", "resources", "chrome-extension", "rearvy-browser-relay"),
    path.join(process.cwd(), "desktop-app", "resources", "chrome-extension", "rearvy-browser-relay"),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(candidate, "manifest.json"))) {
      return candidate;
    }
  }

  return candidates[1];
}

function normalizeTabs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 50).map((tab) => ({
    id: typeof tab?.id === "number" ? tab.id : null,
    title: asString(tab?.title),
    url: asString(tab?.url),
    active: tab?.active === true,
  }));
}

function getRelayStatus() {
  const fresh =
    extensionState.connected &&
    extensionState.lastSeenAt &&
    Date.now() - Date.parse(extensionState.lastSeenAt) < 15000;

  return {
    ok: true,
    port: serverPort || DEFAULT_RELAY_PORT,
    connected: Boolean(fresh),
    extension: {
      connected: Boolean(fresh),
      id: extensionState.id,
      version: extensionState.version,
      tabCount: extensionState.tabCount,
      tabs: extensionState.tabs,
      lastSeenAt: extensionState.lastSeenAt,
    },
    pairingCode:
      pairingCode && Date.now() < pairingExpiresAt ? pairingCode : null,
    extensionPath: getExtensionRoot(),
    queuedCommands: commandQueue.length,
  };
}

function createPairingCode() {
  pairingCode = makePairingCode();
  pairingExpiresAt = Date.now() + 10 * 60 * 1000;
  return {
    ok: true,
    pairingCode,
    expiresAt: new Date(pairingExpiresAt).toISOString(),
    port: serverPort || DEFAULT_RELAY_PORT,
    extensionPath: getExtensionRoot(),
  };
}

function isAuthorizedExtension(body) {
  const extensionId = asString(body?.extensionId, asString(body?.id));
  const providedPairingCode = asString(body?.pairingCode);

  if (pairedExtensionId && extensionId === pairedExtensionId) {
    return true;
  }

  if (
    pairingCode &&
    providedPairingCode &&
    providedPairingCode.toUpperCase() === pairingCode &&
    Date.now() < pairingExpiresAt
  ) {
    pairedExtensionId = extensionId || pairedExtensionId || "paired-extension";
    pairingCode = null;
    pairingExpiresAt = 0;
    return true;
  }

  return false;
}

function enqueueCommand(input) {
  if (!getRelayStatus().connected) {
    return {
      ok: false,
      error: "Browser extension relay is not connected.",
    };
  }

  const command = {
    id: makeId("browser_command"),
    type: asString(input?.type, "extract"),
    target: input?.target ?? null,
    value: input?.value ?? null,
    url: input?.url ?? null,
    tabId: typeof input?.tabId === "number" ? input.tabId : null,
    createdAt: Date.now(),
    status: "queued",
    result: null,
    error: null,
  };

  commands.set(command.id, command);
  commandQueue.push(command.id);
  cleanOldCommands();
  return { ok: true, command };
}

function completeCommand(input) {
  const id = asString(input?.commandId, asString(input?.id));
  const command = commands.get(id);
  if (!command) {
    return { ok: false, error: "Command not found." };
  }

  command.status = input?.ok === false ? "failed" : "completed";
  command.result = input?.result ?? null;
  command.error = input?.error ?? null;
  command.completedAt = Date.now();
  return { ok: true, command };
}

function createRelayApp() {
  const relayApp = express();
  relayApp.use(express.json({ limit: "2mb" }));
  relayApp.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  relayApp.get("/status", (_req, res) => {
    res.json(getRelayStatus());
  });

  relayApp.post("/pairing-code", (_req, res) => {
    res.json(createPairingCode());
  });

  relayApp.post("/command", (req, res) => {
    const result = enqueueCommand(req.body || {});
    res.status(result.ok ? 202 : 409).json(result);
  });

  relayApp.get("/commands/:id", (req, res) => {
    const command = commands.get(req.params.id);
    if (!command) {
      res.status(404).json({ ok: false, error: "Command not found." });
      return;
    }
    res.json({ ok: true, command });
  });

  relayApp.post("/extension/heartbeat", (req, res) => {
    if (!isAuthorizedExtension(req.body || {})) {
      res.status(403).json({
        ok: false,
        error: "Pair the extension from Rearvy Desktop before connecting.",
        pairingRequired: true,
      });
      return;
    }

    const body = req.body || {};
    const tabs = normalizeTabs(body.tabs);
    extensionState = {
      connected: true,
      id: asString(body.extensionId, pairedExtensionId || "paired-extension"),
      version: asString(body.version),
      tabCount: tabs.length,
      tabs,
      lastSeenAt: nowIso(),
    };
    res.json({ ok: true, status: getRelayStatus() });
  });

  relayApp.get("/extension/poll", (req, res) => {
    const extensionId = asString(req.query.extensionId);
    if (pairedExtensionId && extensionId !== pairedExtensionId) {
      res.status(403).json({ ok: false, error: "Extension is not paired." });
      return;
    }

    const commandId = commandQueue.shift();
    if (!commandId) {
      res.json({ ok: true, command: null });
      return;
    }

    const command = commands.get(commandId);
    if (!command) {
      res.json({ ok: true, command: null });
      return;
    }

    command.status = "sent";
    res.json({ ok: true, command });
  });

  relayApp.post("/extension/result", (req, res) => {
    res.json(completeCommand(req.body || {}));
  });

  return relayApp;
}

function listenOnPort(relayApp, port) {
  return new Promise((resolve, reject) => {
    const nextServer = relayApp.listen(port, "127.0.0.1", () => {
      const address = nextServer.address();
      server = nextServer;
      serverPort = address && typeof address === "object" ? address.port : port;
      resolve({ port: serverPort });
    });

    nextServer.once("error", reject);
  });
}

async function startBrowserRelayServer() {
  if (server) {
    return { port: serverPort };
  }

  if (startPromise) {
    return startPromise;
  }

  startPromise = listenOnPort(createRelayApp(), DEFAULT_RELAY_PORT).finally(() => {
    startPromise = null;
  });

  return startPromise;
}

function stopBrowserRelayServer() {
  if (!server) {
    return;
  }

  server.close();
  server = null;
  serverPort = null;
}

async function probeCdpDirect() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(`http://127.0.0.1:${DEFAULT_CDP_PORT}/json/version`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    return {
      connected: Boolean(payload?.Browser || payload?.webSocketDebuggerUrl),
      method: "cdp-direct",
      port: DEFAULT_CDP_PORT,
      browser: payload?.Browser || null,
      version: payload?.Browser || null,
      webSocketDebuggerUrl: payload?.webSocketDebuggerUrl || null,
    };
  } catch (error) {
    return {
      connected: false,
      method: "cdp-direct",
      port: DEFAULT_CDP_PORT,
      error: error?.message || String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getConnectionStatus() {
  const cdpDirect = await probeCdpDirect();
  const extensionRelay = getRelayStatus().extension;
  return {
    cdpDirect,
    extensionRelay: {
      connected: Boolean(extensionRelay.connected),
      method: "extension-relay",
      port: serverPort || DEFAULT_RELAY_PORT,
      extensionId: extensionRelay.id,
      version: extensionRelay.version,
      tabCount: extensionRelay.tabCount,
      lastSeenAt: extensionRelay.lastSeenAt,
    },
    recommendedMethod: cdpDirect.connected
      ? "cdp-direct"
      : extensionRelay.connected
        ? "extension-relay"
        : "cdp-direct",
  };
}

function findChromeExecutable() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

  return candidates.find((candidate) => {
    if (!candidate) return false;
    if (candidate.includes(path.sep)) {
      return fs.existsSync(candidate);
    }
    return true;
  });
}

async function openChromeInternalUrl(url) {
  if (typeof url !== "string" || !url.startsWith("chrome://")) {
    throw new Error("Only chrome:// setup URLs are supported.");
  }

  const chrome = findChromeExecutable();
  if (!chrome) {
    throw new Error("Google Chrome was not found on this computer.");
  }

  await new Promise((resolve, reject) => {
    const child = spawn(chrome, [url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      try {
        child.unref();
      } catch {}
      resolve();
    });
  });

  return { ok: true };
}

async function openExtensionFolder() {
  const extensionPath = getExtensionRoot();
  const result = await shell.openPath(extensionPath);
  if (result) {
    throw new Error(result);
  }
  return { ok: true, extensionPath };
}

function copyExtensionPath() {
  const extensionPath = getExtensionRoot();
  clipboard.writeText(extensionPath);
  return { ok: true, extensionPath };
}

function getRelayInfo() {
  return {
    ok: true,
    port: serverPort || DEFAULT_RELAY_PORT,
    extensionPath: getExtensionRoot(),
    pairingCode:
      pairingCode && Date.now() < pairingExpiresAt ? pairingCode : null,
    appVersion: app?.getVersion?.() || null,
  };
}

module.exports = {
  startBrowserRelayServer,
  stopBrowserRelayServer,
  getConnectionStatus,
  createPairingCode,
  openChromeInternalUrl,
  openExtensionFolder,
  copyExtensionPath,
  getRelayInfo,
  enqueueCommand,
  getRelayStatus,
};
