const express = require("express");
const { spawn } = require("child_process");
const { clipboard, shell, app } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_RELAY_PORT = Number(process.env.REARVY_BROWSER_RELAY_PORT || 48732);
const DEFAULT_CDP_PORT = Number(process.env.REARVY_BROWSER_CDP_PORT || 9222);
const COMMAND_TTL_MS = 5 * 60 * 1000;
const EXTENSION_ACTIVE_MS = 15 * 1000;

let server = null;
let serverPort = null;
let startPromise = null;
let pairingCode = null;
let pairingExpiresAt = 0;
let pairedExtensionId = null;
let lastSeenExtensionId = null;
let lastSeenExtensionVersion = null;
let lastSeenExtensionAt = null;
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

function ignoreExpectedChildProcessCleanupError(error) {
  void error;
}

function nowIso() {
  return new Date().toISOString();
}

function parseTimeMs(value) {
  const parsed = Date.parse(asString(value));
  return Number.isFinite(parsed) ? parsed : 0;
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

function isChromeExtensionId(value) {
  return /^[a-p]{32}$/.test(asString(value));
}

function rememberExtensionAttempt(body) {
  const extensionId = asString(body?.extensionId, asString(body?.id));
  if (!isChromeExtensionId(extensionId)) {
    return;
  }

  lastSeenExtensionId = extensionId;
  lastSeenExtensionVersion = asString(body?.version);
  lastSeenExtensionAt = nowIso();
}

function getKnownExtensionId() {
  return [extensionState.id, pairedExtensionId, lastSeenExtensionId].find(isChromeExtensionId) || null;
}

function hasTrustedExtension() {
  return Boolean(
    [extensionState.id, pairedExtensionId].find(isChromeExtensionId)
  );
}

function getExtensionOptionsUrl() {
  const extensionId = getKnownExtensionId();
  return extensionId ? `chrome-extension://${extensionId}/options.html` : null;
}

function withOptionsPageParams(optionsUrl, options = {}) {
  const url = new URL(optionsUrl);
  const nextPairingCode = asString(options.pairingCode).toUpperCase();
  const nextRelayUrl = asString(options.relayUrl);

  if (nextPairingCode) {
    url.searchParams.set("pairingCode", nextPairingCode);
    url.searchParams.set("autoConnect", "1");
  }

  if (nextRelayUrl) {
    url.searchParams.set("relayUrl", nextRelayUrl);
  }

  return url.toString();
}

function getRelayBaseUrl() {
  return `http://127.0.0.1:${serverPort || DEFAULT_RELAY_PORT}`;
}

function getRelaySetupUrl(options = {}) {
  const url = new URL(`${getRelayBaseUrl()}/browser-relay/setup`);
  const nextPairingCode = asString(options.pairingCode).toUpperCase();
  const nextRelayUrl = asString(options.relayUrl, getRelayBaseUrl());

  if (nextPairingCode) {
    url.searchParams.set("pairingCode", nextPairingCode);
  }

  if (nextRelayUrl) {
    url.searchParams.set("relayUrl", nextRelayUrl);
  }

  return url.toString();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function renderRelaySetupPage(req) {
  const requestedPairingCode = asString(req.query?.pairingCode).toUpperCase();
  const activePairingCode =
    pairingCode && Date.now() < pairingExpiresAt ? pairingCode : "";
  const nextPairingCode = requestedPairingCode || activePairingCode;
  const nextRelayUrl = asString(req.query?.relayUrl, getRelayBaseUrl());

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Rearvy Browser Relay Setup</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f8fafc;
        --panel: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --border: #dbe3ef;
        --accent: #047857;
        --accent-soft: #dcfce7;
        --warn: #92400e;
        --warn-soft: #fef3c7;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      main {
        width: min(760px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 56px 0;
      }

      .panel {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
        box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
        padding: 28px;
      }

      h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.2;
      }

      p {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.6;
      }

      .status {
        margin-top: 22px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 14px;
        background: #f8fafc;
      }

      .status[data-state="connected"] {
        border-color: #86efac;
        background: var(--accent-soft);
      }

      .status[data-state="waiting"],
      .status[data-state="manual"] {
        border-color: #fde68a;
        background: var(--warn-soft);
      }

      .status-title {
        margin: 0;
        color: var(--text);
        font-size: 15px;
        font-weight: 800;
      }

      .status-copy {
        margin-top: 4px;
        color: var(--muted);
        font-size: 14px;
      }

    </style>
  </head>
  <body
    data-rearvy-browser-relay-setup="1"
    data-pairing-code="${escapeHtml(nextPairingCode)}"
    data-relay-url="${escapeHtml(nextRelayUrl)}"
  >
    <main>
      <section class="panel">
        <h1>Connect Rearvy Extension</h1>
        <p>Rearvy is pairing the browser extension with Rearvy Desktop automatically.</p>

        <div id="status" class="status" data-state="waiting" aria-live="polite">
          <h2 id="statusTitle" class="status-title">Waiting for Rearvy extension</h2>
          <p id="statusCopy" class="status-copy">If the extension is installed, it will connect to Rearvy within a few seconds.</p>
        </div>
      </section>
    </main>
    <script>
      const status = document.getElementById("status");
      const statusTitle = document.getElementById("statusTitle");
      const statusCopy = document.getElementById("statusCopy");
      let extensionDetected = false;

      function setStatus(state, title, copy) {
        status.dataset.state = state;
        statusTitle.textContent = title;
        statusCopy.textContent = copy;
      }

      window.addEventListener("message", (event) => {
        if (event.source !== window || event.origin !== window.location.origin) {
          return;
        }

        const message = event.data || {};
        if (message.type === "rearvy:relayExtensionDetected") {
          extensionDetected = true;
          setStatus("waiting", "Extension detected", "Applying the pairing code to the Rearvy Browser Relay extension.");
        }

        if (message.type === "rearvy:relaySetupStatus") {
          extensionDetected = true;
          if (message.ok === false) {
            setStatus("waiting", "Pairing saved", message.error || "Rearvy is finishing setup automatically. No extension click is needed.");
            return;
          }
          setStatus("connected", "Rearvy extension connected", "This tab will close automatically. Return to Rearvy Desktop.");
          window.setTimeout(() => window.close(), 900);
        }
      });

      window.setTimeout(() => {
        if (!extensionDetected) {
          setStatus("waiting", "Waiting for the extension", "Rearvy will pair automatically when the browser extension is present. No extension click is needed.");
        }
      }, 2500);
    </script>
  </body>
</html>`;
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
  const lastSeenAt = extensionState.lastSeenAt || lastSeenExtensionAt;
  const active =
    extensionState.connected &&
    lastSeenAt &&
    Date.now() - parseTimeMs(lastSeenAt) < EXTENSION_ACTIVE_MS;
  const trusted = hasTrustedExtension();
  const available = Boolean(active || trusted);

  return {
    ok: true,
    port: serverPort || DEFAULT_RELAY_PORT,
    connected: available,
    extension: {
      connected: available,
      active: Boolean(active),
      trusted,
      stale: available && !active,
      id: extensionState.id,
      knownId: getKnownExtensionId(),
      version: extensionState.version || lastSeenExtensionVersion,
      tabCount: extensionState.tabCount,
      tabs: extensionState.tabs,
      lastSeenAt,
      lastSeenAttemptAt: lastSeenExtensionAt,
      optionsUrl: getExtensionOptionsUrl(),
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

  if (!pairedExtensionId && !pairingCode && isChromeExtensionId(extensionId)) {
    pairedExtensionId = extensionId;
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
  const status = getRelayStatus();
  if (!status.connected) {
    return {
      ok: false,
      error: "Rearvy has not seen the browser extension yet.",
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
  relayApp.use(express.json({ limit: "12mb" }));
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

  relayApp.get("/browser-relay/setup", (req, res) => {
    res
      .status(200)
      .type("html")
      .send(renderRelaySetupPage(req));
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
    rememberExtensionAttempt(req.body || {});

    if (!isAuthorizedExtension(req.body || {})) {
      res.status(403).json({
        ok: false,
        error: "Rearvy Desktop is preparing a fresh browser relay pairing.",
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

    if (isChromeExtensionId(extensionId)) {
      const seenAt = nowIso();
      lastSeenExtensionId = extensionId;
      lastSeenExtensionAt = seenAt;
      extensionState = {
        ...extensionState,
        connected: true,
        id: extensionState.id || extensionId,
        lastSeenAt: seenAt,
      };
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
      active: Boolean(extensionRelay.active),
      trusted: Boolean(extensionRelay.trusted),
      stale: Boolean(extensionRelay.stale),
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

function browserCandidate(name, executable, internalScheme = "chrome") {
  return { name, executable, internalScheme };
}

function getBrowserExecutableCandidates() {
  const configuredExecutable = asString(
    process.env.REARVY_BROWSER_EXECUTABLE,
    asString(process.env.BROWSER_EXECUTABLE)
  );
  const configuredName = asString(process.env.REARVY_BROWSER_NAME, "Configured browser");
  const configuredScheme = asString(process.env.REARVY_BROWSER_INTERNAL_SCHEME, "chrome").replace(/:.*$/, "");
  const configuredCandidates = configuredExecutable
    ? [browserCandidate(configuredName, configuredExecutable, configuredScheme)]
    : [];

  if (process.platform === "win32") {
    return [
      ...configuredCandidates,
      browserCandidate("Google Chrome", path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"), "chrome"),
      browserCandidate("Google Chrome", path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"), "chrome"),
      browserCandidate("Google Chrome", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"), "chrome"),
      browserCandidate("Microsoft Edge", path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"), "edge"),
      browserCandidate("Microsoft Edge", path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"), "edge"),
      browserCandidate("Microsoft Edge", path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"), "edge"),
      browserCandidate("Brave", path.join(process.env.PROGRAMFILES || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), "brave"),
      browserCandidate("Brave", path.join(process.env["PROGRAMFILES(X86)"] || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), "brave"),
      browserCandidate("Brave", path.join(process.env.LOCALAPPDATA || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), "brave"),
      browserCandidate("Vivaldi", path.join(process.env.LOCALAPPDATA || "", "Vivaldi", "Application", "vivaldi.exe"), "vivaldi"),
      browserCandidate("Vivaldi", path.join(process.env.PROGRAMFILES || "", "Vivaldi", "Application", "vivaldi.exe"), "vivaldi"),
      browserCandidate("Opera", path.join(process.env.LOCALAPPDATA || "", "Programs", "Opera", "opera.exe"), "opera"),
      browserCandidate("Opera GX", path.join(process.env.LOCALAPPDATA || "", "Programs", "Opera GX", "opera.exe"), "opera"),
    ];
  }

  if (process.platform === "darwin") {
    return [
      ...configuredCandidates,
      browserCandidate("Google Chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "chrome"),
      browserCandidate("Microsoft Edge", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "edge"),
      browserCandidate("Brave", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", "brave"),
      browserCandidate("Chromium", "/Applications/Chromium.app/Contents/MacOS/Chromium", "chrome"),
      browserCandidate("Vivaldi", "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi", "vivaldi"),
      browserCandidate("Opera", "/Applications/Opera.app/Contents/MacOS/Opera", "opera"),
    ];
  }

  return [
    ...configuredCandidates,
    browserCandidate("Google Chrome", "google-chrome", "chrome"),
    browserCandidate("Google Chrome", "google-chrome-stable", "chrome"),
    browserCandidate("Chromium", "chromium", "chrome"),
    browserCandidate("Chromium", "chromium-browser", "chrome"),
    browserCandidate("Microsoft Edge", "microsoft-edge", "edge"),
    browserCandidate("Microsoft Edge", "microsoft-edge-stable", "edge"),
    browserCandidate("Brave", "brave-browser", "brave"),
    browserCandidate("Vivaldi", "vivaldi", "vivaldi"),
    browserCandidate("Opera", "opera", "opera"),
  ];
}

function findBrowserExecutable() {
  return getBrowserExecutableCandidates().find((candidate) => {
    if (!candidate?.executable) return false;
    if (/[\\/]/.test(candidate.executable)) {
      return fs.existsSync(candidate.executable);
    }
    return true;
  });
}

function normalizeInternalUrlForBrowser(url, browser) {
  const value = asString(url);
  const match = value.match(/^([a-z][a-z0-9+.-]*):\/\/(.+)$/i);
  const supportedSchemes = new Set(["chrome", "edge", "brave", "vivaldi", "opera"]);

  if (!match || !supportedSchemes.has(match[1].toLowerCase())) {
    throw new Error("Only Chromium-family browser setup URLs are supported.");
  }

  const internalScheme = asString(browser?.internalScheme, match[1].toLowerCase());
  return `${internalScheme}://${match[2]}`;
}

async function openBrowserInternalUrl(url) {
  const browser = findBrowserExecutable();
  if (!browser) {
    throw new Error("A supported Chromium-family browser was not found on this computer.");
  }

  const browserUrl = normalizeInternalUrlForBrowser(url, browser);
  return openUrlInBrowser(browser, browserUrl);
}

async function openUrlInBrowser(browser, browserUrl) {
  await new Promise((resolve, reject) => {
    const child = spawn(browser.executable, [browserUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      try {
        child.unref();
      } catch (error) {
        ignoreExpectedChildProcessCleanupError(error);
      }
      resolve();
    });
  });

  return { ok: true, browser: browser.name, url: browserUrl };
}

async function openChromeInternalUrl(url) {
  return openBrowserInternalUrl(url);
}

async function openExtensionOptionsPage(options = {}) {
  const optionsUrl = getExtensionOptionsUrl();
  if (!optionsUrl) {
    const browser = findBrowserExecutable();
    if (!browser) {
      throw new Error("A supported Chromium-family browser was not found on this computer.");
    }

    const setupUrl = getRelaySetupUrl(options);
    const result = await openUrlInBrowser(browser, setupUrl);
    return {
      ...result,
      fallback: true,
      setupUrl,
      reason: "Rearvy has not seen the browser relay extension yet.",
    };
  }

  const browser = findBrowserExecutable();
  if (!browser) {
    throw new Error("A supported Chromium-family browser was not found on this computer.");
  }

  const resolvedOptionsUrl = withOptionsPageParams(optionsUrl, options);
  const result = await openUrlInBrowser(browser, resolvedOptionsUrl);
  return {
    ...result,
    extensionId: getKnownExtensionId(),
    optionsUrl: resolvedOptionsUrl,
  };
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
    extensionId: getKnownExtensionId(),
    extensionOptionsUrl: getExtensionOptionsUrl(),
    relaySetupUrl: getRelaySetupUrl(),
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
  openBrowserInternalUrl,
  openChromeInternalUrl,
  openExtensionOptionsPage,
  openExtensionFolder,
  copyExtensionPath,
  getRelayInfo,
  enqueueCommand,
  getRelayStatus,
};
