(() => {
  const ROOT_ID = "rearvy-agent-chip-root";
  const WATCHED_STORAGE_KEYS = [
    "relayEnabled",
    "pairingCode",
    "connected",
    "lastError",
    "lastSeenAt",
    "relayUrl",
  ];

  if (!/^https?:$/.test(window.location.protocol)) {
    return;
  }

  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = ROOT_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const iconUrl = chrome.runtime.getURL("icons/icon32.png");

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      button {
        font: inherit;
      }

      .rearvy-agent {
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 2147483647;
        color: #111827;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        max-width: min(210px, calc(100vw - 24px));
        min-height: 32px;
        border: 1px solid #2563eb;
        border-radius: 7px;
        background: #ffffff;
        color: #1746d3;
        padding: 0 10px 0 8px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
        cursor: pointer;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0;
        line-height: 1;
      }

      .chip:hover {
        background: #f8fbff;
      }

      .mark {
        width: 17px;
        height: 17px;
        flex: 0 0 17px;
        object-fit: contain;
      }

      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dot {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 999px;
        background: #9ca3af;
      }

      .rearvy-agent[data-state="connected"] .dot {
        background: #00a37a;
      }

      .rearvy-agent[data-state="connecting"] .dot {
        background: #f59e0b;
      }

      .rearvy-agent[data-state="error"] .dot {
        background: #ef4444;
      }

      @media (max-width: 380px) {
        .rearvy-agent {
          left: 8px;
          top: 8px;
        }

        .chip {
          max-width: calc(100vw - 16px);
        }
      }
    </style>

    <div class="rearvy-agent" data-state="disabled">
      <button class="chip" type="button" title="Connect Rearvy" aria-label="Connect Rearvy">
        <img class="mark" alt="" src="${iconUrl}" />
        <span class="label">Connect Rearvy</span>
        <span class="dot" aria-hidden="true"></span>
      </button>
    </div>
  `;

  const agent = shadow.querySelector(".rearvy-agent");
  const chip = shadow.querySelector(".chip");
  const chipLabel = shadow.querySelector(".label");

  let currentStatus = {
    enabled: false,
    connected: false,
    lastError: "",
    lastSeenAt: "",
  };

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

  function isRelaySetupPage() {
    const localHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
    return (
      window.location.protocol === "http:" &&
      localHosts.has(window.location.hostname) &&
      window.location.pathname === "/browser-relay/setup"
    );
  }

  function normalizePairingCode(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 16);
  }

  function readSetupPairingRequest() {
    if (!isRelaySetupPage()) {
      return null;
    }

    const setupRoot =
      document.querySelector("[data-rearvy-browser-relay-setup='1']") ||
      document.body ||
      document.documentElement;
    const pairingCode = normalizePairingCode(setupRoot?.dataset?.pairingCode);
    const relayUrl = String(setupRoot?.dataset?.relayUrl || "").trim();

    if (!pairingCode) {
      return null;
    }

    return { pairingCode, relayUrl };
  }

  async function applySetupPagePairing() {
    const pairingRequest = readSetupPairingRequest();
    if (!pairingRequest) {
      return;
    }

    window.postMessage(
      { type: "rearvy:relayExtensionDetected" },
      window.location.origin
    );

    const response = await sendMessage({
      type: "rearvy:applyPairingRequest",
      ...pairingRequest,
    });

    window.postMessage(
      {
        type: "rearvy:relaySetupStatus",
        ok: response?.ok !== false,
        error: response?.error || "",
        status: response?.status || null,
      },
      window.location.origin
    );
  }

  function formatTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function renderStatus(status) {
    currentStatus = {
      enabled: Boolean(status.enabled),
      connected: Boolean(status.connected),
      lastError: typeof status.lastError === "string" ? status.lastError : "",
      lastSeenAt: typeof status.lastSeenAt === "string" ? status.lastSeenAt : "",
    };

    let state = "disabled";
    let label = "Connect Rearvy";
    let title = "Connect Rearvy";

    if (currentStatus.enabled && currentStatus.connected) {
      state = "connected";
      label = "Rearvy Connected";
      const lastSeen = formatTime(currentStatus.lastSeenAt);
      title = lastSeen ? `Rearvy connected. Last seen ${lastSeen}.` : "Rearvy connected.";
    } else if (currentStatus.enabled && currentStatus.lastError) {
      state = "error";
      label = "Connect Rearvy";
      title = currentStatus.lastError;
    } else if (currentStatus.enabled) {
      state = "connecting";
      label = "Connecting Rearvy";
      title = "Connecting Rearvy";
    }

    agent.dataset.state = state;
    chipLabel.textContent = label;
    chip.title = title;
    chip.setAttribute("aria-label", title);
  }

  async function refreshStatus() {
    const response = await sendMessage({ type: "rearvy:getRelayStatus" });
    if (response && response.ok !== false) {
      renderStatus(response.status || response);
    }
  }

  async function connectRearvy() {
    renderStatus({
      ...currentStatus,
      enabled: true,
      connected: false,
      lastError: "",
    });

    const response = await sendMessage({
      type: "rearvy:connectRearvy",
      url: window.location.href,
    });

    if (response && response.ok !== false) {
      renderStatus(response.status || response);
      return;
    }

    renderStatus({
      enabled: true,
      connected: false,
      lastError: response?.error || "Could not connect to Rearvy.",
      lastSeenAt: "",
    });
  }

  chip.addEventListener("click", () => {
    void connectRearvy();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }

    if (WATCHED_STORAGE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
      void refreshStatus();
    }
  });

  document.documentElement.appendChild(host);
  void applySetupPagePairing();
  void refreshStatus();
  setInterval(() => void refreshStatus(), 3000);
})();
