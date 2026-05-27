const DEFAULT_RELAY_URL = "http://127.0.0.1:48732";

const pairingCode = document.getElementById("pairingCode");
const relayUrl = document.getElementById("relayUrl");
const saveStatus = document.getElementById("saveStatus");
const save = document.getElementById("save");
const statusPanel = document.getElementById("statusPanel");
const statusTitle = document.getElementById("statusTitle");
const statusCopy = document.getElementById("statusCopy");
const connectToggle = document.getElementById("connectToggle");
const settingsDetails = document.getElementById("settingsDetails");
const version = document.getElementById("version");

let currentEnabled = false;

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
    const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
    if (url.protocol === "http:" && localHosts.has(url.hostname)) {
      return url.toString().replace(/\/$/, "");
    }
  } catch {}

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

function setSwitch(enabled) {
  currentEnabled = enabled;
  connectToggle.setAttribute("aria-checked", enabled ? "true" : "false");
  connectToggle.setAttribute(
    "aria-label",
    enabled ? "Disable Rearvy Browser Relay" : "Enable Rearvy Browser Relay"
  );
}

function renderStatus(data) {
  const enabled = relayEnabled(data);
  setSwitch(enabled);

  if (!enabled) {
    statusPanel.dataset.state = "disabled";
    statusTitle.textContent = "Not Enabled";
    statusCopy.textContent = "Click the toggle or toolbar icon to enable.";
    return;
  }

  if (data.connected) {
    statusPanel.dataset.state = "connected";
    statusTitle.textContent = "Connected";
    statusCopy.textContent = `Last seen ${formatLastSeen(data.lastSeenAt)}.`;
    return;
  }

  if (data.lastError) {
    statusPanel.dataset.state = "error";
    statusTitle.textContent = "Needs Attention";
    statusCopy.textContent = data.lastError;
    return;
  }

  statusPanel.dataset.state = "connecting";
  statusTitle.textContent = "Connecting";
  statusCopy.textContent = "Waiting for Rearvy Desktop to accept the relay heartbeat.";
}

function currentFormValues() {
  return {
    pairingCode: normalizePairingCode(pairingCode.value),
    relayUrl: relayUrl.value.trim() || DEFAULT_RELAY_URL,
  };
}

function requestImmediateHeartbeat(enabled) {
  chrome.runtime.sendMessage(
    { type: "rearvy:setRelayEnabled", enabled },
    () => {
      void chrome.runtime.lastError;
    }
  );
}

function saveSettings(enableRelay) {
  const values = currentFormValues();
  const nextEnabled = typeof enableRelay === "boolean" ? enableRelay : currentEnabled;

  chrome.storage.local.set(
    {
      ...values,
      relayEnabled: nextEnabled,
      connected: false,
      lastError: "",
    },
    () => {
      saveStatus.textContent = nextEnabled
        ? "Saved. Rearvy will connect within a few seconds."
        : "Saved. Connect is off.";
      renderStatus({ ...values, relayEnabled: nextEnabled, connected: false, lastError: "" });

      if (nextEnabled && !values.pairingCode) {
        settingsDetails.open = true;
        saveStatus.textContent = "Saved. Add a desktop pairing code if Rearvy asks for one.";
      }

      requestImmediateHeartbeat(nextEnabled);
    }
  );
}

function loadSettings() {
  const pairingRequest = readUrlPairingRequest();

  chrome.storage.local.get(
    ["pairingCode", "relayUrl", "relayEnabled", "connected", "lastError", "lastSeenAt"],
    (data) => {
      const nextPairingCode = pairingRequest?.pairingCode || data.pairingCode || "";
      const nextRelayUrl = pairingRequest?.relayUrl || data.relayUrl || DEFAULT_RELAY_URL;

      pairingCode.value = nextPairingCode;
      relayUrl.value = nextRelayUrl;

      if (pairingRequest) {
        const nextEnabled = pairingRequest.autoConnect || Boolean(nextPairingCode);
        chrome.storage.local.set(
          {
            pairingCode: nextPairingCode,
            relayUrl: nextRelayUrl,
            relayEnabled: nextEnabled,
            connected: false,
            lastError: "",
          },
          () => {
            settingsDetails.open = true;
            renderStatus({
              pairingCode: nextPairingCode,
              relayUrl: nextRelayUrl,
              relayEnabled: nextEnabled,
              connected: false,
              lastError: "",
            });
            saveStatus.textContent = nextPairingCode
              ? "Fresh pairing code applied from Rearvy Desktop. Connecting..."
              : "Relay URL applied from Rearvy Desktop.";
            requestImmediateHeartbeat(nextEnabled);
          }
        );
        return;
      }

      renderStatus(data);
      saveStatus.textContent = "Settings loaded.";
    }
  );
}

version.textContent = `v${chrome.runtime.getManifest().version}`;

save.addEventListener("click", () => {
  saveSettings(true);
});

connectToggle.addEventListener("click", () => {
  saveSettings(!currentEnabled);
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
