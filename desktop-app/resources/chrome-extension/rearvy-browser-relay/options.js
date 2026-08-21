const DEFAULT_RELAY_URL = "http://127.0.0.1:48732";

const saveStatus = document.getElementById("saveStatus");
const statusPanel = document.getElementById("statusPanel");
const statusTitle = document.getElementById("statusTitle");
const statusCopy = document.getElementById("statusCopy");
const connectButton = document.getElementById("connectButton");
const version = document.getElementById("version");

let currentSettings = {
  pairingCode: "",
  relayUrl: DEFAULT_RELAY_URL,
};

function ignoreExpectedParseError(error) {
  void error;
}

function normalizePairingCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function normalizeRelayUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    const localHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
    if (url.protocol === "http:" && localHosts.has(url.hostname)) {
      return url.toString().replace(/\/$/, "");
    }
  } catch (error) {
    ignoreExpectedParseError(error);
  }

  return "";
}

function readUrlPairingRequest() {
  const params = new URLSearchParams(location.search);
  const nextPairingCode = normalizePairingCode(params.get("pairingCode"));
  const nextRelayUrl = normalizeRelayUrl(params.get("relayUrl"));
  const autoConnect = params.get("autoConnect") === "1";

  if (!nextPairingCode && !nextRelayUrl && !autoConnect) {
    return null;
  }

  return {
    pairingCode: nextPairingCode,
    relayUrl: nextRelayUrl,
    autoConnect,
  };
}

function relayEnabled(data) {
  if (typeof data.relayEnabled === "boolean") {
    return data.relayEnabled;
  }
  return Boolean(data.pairingCode);
}

function formatLastSeen(value) {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function renderStatus(data) {
  const enabled = relayEnabled(data);

  if (enabled && data.connected) {
    statusPanel.dataset.state = "connected";
    statusTitle.textContent = "Connected to Rearvy";
    statusCopy.textContent = `Last seen ${formatLastSeen(data.lastSeenAt)}.`;
    connectButton.textContent = "Connected";
    connectButton.disabled = true;
    return;
  }

  connectButton.disabled = false;

  if (enabled && data.lastError) {
    statusPanel.dataset.state = "error";
    statusTitle.textContent = "Could not connect";
    statusCopy.textContent = data.lastError;
    connectButton.textContent = "Connect Rearvy";
    return;
  }

  if (enabled) {
    statusPanel.dataset.state = "connecting";
    statusTitle.textContent = "Connecting to Rearvy";
    statusCopy.textContent = "Waiting for Rearvy Desktop to accept the relay heartbeat.";
    connectButton.textContent = "Connect Rearvy";
    return;
  }

  statusPanel.dataset.state = "disabled";
  statusTitle.textContent = "Ready to Connect";
  statusCopy.textContent = "Rearvy Desktop can attach this browser automatically when a browser task starts.";
  connectButton.textContent = "Connect Rearvy";
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: true });
    });
  });
}

function requestImmediateHeartbeat(enabled) {
  chrome.runtime.sendMessage(
    { type: "rearvy:setRelayEnabled", enabled },
    () => {
      void chrome.runtime.lastError;
    }
  );
}

function applyPairingSettings(pairingRequest) {
  const nextPairingCode = pairingRequest?.pairingCode || currentSettings.pairingCode;
  const nextRelayUrl =
    pairingRequest?.relayUrl || currentSettings.relayUrl || DEFAULT_RELAY_URL;
  const nextEnabled = pairingRequest?.autoConnect || Boolean(nextPairingCode);

  currentSettings = {
    pairingCode: nextPairingCode,
    relayUrl: nextRelayUrl,
  };

  chrome.storage.local.set(
    {
      pairingCode: nextPairingCode,
      relayUrl: nextRelayUrl,
      relayEnabled: nextEnabled,
      connected: false,
      lastError: "",
    },
    () => {
      renderStatus({
        pairingCode: nextPairingCode,
        relayUrl: nextRelayUrl,
        relayEnabled: nextEnabled,
        connected: false,
        lastError: "",
      });
      saveStatus.textContent = nextEnabled
        ? "Pairing applied. Connecting..."
        : "Pairing details saved.";
      requestImmediateHeartbeat(nextEnabled);
    }
  );
}

async function connectRearvy() {
  connectButton.disabled = true;
  connectButton.textContent = "Connecting...";
  saveStatus.textContent = "Opening Rearvy...";

  const response = await sendMessage({
    type: "rearvy:connectRearvy",
    url: "https://rearvy.com/chat",
  });

  if (response && response.ok !== false) {
    renderStatus(response.status || response);
    saveStatus.textContent = "Rearvy is opening. Connection will finish automatically.";
    return;
  }

  renderStatus({
    ...currentSettings,
    relayEnabled: true,
    connected: false,
    lastError: response?.error || "Could not connect to Rearvy.",
  });
  saveStatus.textContent = response?.error || "Could not connect to Rearvy.";
}

function loadSettings() {
  const pairingRequest = readUrlPairingRequest();

  chrome.storage.local.get(
    ["pairingCode", "relayUrl", "relayEnabled", "connected", "lastError", "lastSeenAt"],
    (data) => {
      currentSettings = {
        pairingCode: pairingRequest?.pairingCode || data.pairingCode || "",
        relayUrl: pairingRequest?.relayUrl || data.relayUrl || DEFAULT_RELAY_URL,
      };

      if (pairingRequest) {
        applyPairingSettings(pairingRequest);
        return;
      }

      renderStatus(data);
      saveStatus.textContent = "Ready.";
    }
  );
}

version.textContent = `v${chrome.runtime.getManifest().version}`;

connectButton.addEventListener("click", () => {
  void connectRearvy();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }

  const watched = ["pairingCode", "relayUrl", "relayEnabled", "connected", "lastError", "lastSeenAt"];
  if (!watched.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
    return;
  }

  chrome.storage.local.get(watched, renderStatus);
});

loadSettings();
