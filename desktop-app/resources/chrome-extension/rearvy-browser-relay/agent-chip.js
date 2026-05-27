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

      .panel {
        display: none;
        width: min(304px, calc(100vw - 24px));
        margin-top: 8px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
        padding: 14px;
      }

      .rearvy-agent[data-open="true"] .panel {
        display: block;
      }

      .panel-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .title {
        margin: 0;
        color: #111827;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1.25;
      }

      .subtitle {
        margin: 4px 0 0;
        color: #6b7280;
        font-size: 12.5px;
        line-height: 1.45;
      }

      .icon-button {
        display: inline-grid;
        width: 26px;
        height: 26px;
        flex: 0 0 26px;
        place-items: center;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #ffffff;
        color: #4b5563;
        cursor: pointer;
      }

      .icon-button:hover {
        background: #f9fafb;
      }

      .status {
        display: grid;
        grid-template-columns: 9px minmax(0, 1fr);
        align-items: start;
        gap: 9px;
        margin: 14px 0;
        border-radius: 8px;
        background: #f7f7f8;
        padding: 10px;
      }

      .status .dot {
        margin-top: 5px;
      }

      .status-title {
        margin: 0;
        color: #17171c;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.35;
      }

      .status-copy {
        margin: 3px 0 0;
        color: #6b7280;
        font-size: 12px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .button {
        min-height: 34px;
        border-radius: 7px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #111827;
        padding: 0 10px;
        cursor: pointer;
        font-size: 12.5px;
        font-weight: 800;
        letter-spacing: 0;
        white-space: nowrap;
      }

      .button:hover {
        background: #f9fafb;
      }

      .button.primary {
        grid-column: 1 / -1;
        border-color: #111827;
        background: #111827;
        color: #ffffff;
      }

      .button.primary:hover {
        background: #0b1220;
      }

      @media (max-width: 380px) {
        .rearvy-agent {
          left: 8px;
          top: 8px;
        }

        .chip {
          max-width: calc(100vw - 16px);
        }

        .panel {
          width: calc(100vw - 16px);
        }
      }
    </style>

    <div class="rearvy-agent" data-state="disabled" data-open="false">
      <button class="chip" type="button" aria-expanded="false" title="Rearvy Agent">
        <img class="mark" alt="" src="${iconUrl}" />
        <span class="label">Rearvy Agent</span>
        <span class="dot" aria-hidden="true"></span>
      </button>

      <section class="panel" aria-label="Rearvy Agent">
        <div class="panel-head">
          <div>
            <h2 class="title">Rearvy Agent</h2>
            <p class="subtitle">Connect this tab to Rearvy Desktop.</p>
          </div>
          <button class="icon-button close" type="button" aria-label="Close">x</button>
        </div>

        <div class="status" aria-live="polite">
          <span class="dot" aria-hidden="true"></span>
          <div>
            <p class="status-title">Not Enabled</p>
            <p class="status-copy">Use the relay when Rearvy Desktop asks to control a browser.</p>
          </div>
        </div>

        <div class="actions">
          <button class="button primary toggle" type="button">Enable Relay</button>
          <button class="button open-rearvy" type="button">Open Rearvy</button>
          <button class="button settings" type="button">Settings</button>
        </div>
      </section>
    </div>
  `;

  const agent = shadow.querySelector(".rearvy-agent");
  const chip = shadow.querySelector(".chip");
  const close = shadow.querySelector(".close");
  const statusTitle = shadow.querySelector(".status-title");
  const statusCopy = shadow.querySelector(".status-copy");
  const toggle = shadow.querySelector(".toggle");
  const openRearvy = shadow.querySelector(".open-rearvy");
  const settings = shadow.querySelector(".settings");

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
    let title = "Not Enabled";
    let copy = "Use the relay when Rearvy Desktop asks to control a browser.";
    let toggleLabel = "Enable Relay";

    if (currentStatus.enabled && currentStatus.connected) {
      const lastSeen = formatTime(currentStatus.lastSeenAt);
      state = "connected";
      title = "Connected";
      copy = lastSeen ? `Last seen ${lastSeen}.` : "Rearvy Desktop can use this browser.";
      toggleLabel = "Disable Relay";
    } else if (currentStatus.enabled && currentStatus.lastError) {
      state = "error";
      title = "Needs Attention";
      copy = currentStatus.lastError;
      toggleLabel = "Disable Relay";
    } else if (currentStatus.enabled) {
      state = "connecting";
      title = "Connecting";
      copy = "Waiting for Rearvy Desktop to accept the relay heartbeat.";
      toggleLabel = "Disable Relay";
    }

    agent.dataset.state = state;
    statusTitle.textContent = title;
    statusCopy.textContent = copy;
    toggle.textContent = toggleLabel;
  }

  async function refreshStatus() {
    const response = await sendMessage({ type: "rearvy:getRelayStatus" });
    if (response && response.ok !== false) {
      renderStatus(response.status || response);
    }
  }

  function setOpen(open) {
    agent.dataset.open = open ? "true" : "false";
    chip.setAttribute("aria-expanded", open ? "true" : "false");
  }

  chip.addEventListener("click", () => {
    setOpen(agent.dataset.open !== "true");
    void refreshStatus();
  });

  close.addEventListener("click", () => setOpen(false));

  toggle.addEventListener("click", async () => {
    const response = await sendMessage({
      type: "rearvy:setRelayEnabled",
      enabled: !currentStatus.enabled,
    });
    if (response && response.ok !== false) {
      renderStatus(response.status || response);
    }
  });

  openRearvy.addEventListener("click", () => {
    void sendMessage({ type: "rearvy:openRearvy", url: window.location.href });
  });

  settings.addEventListener("click", () => {
    void sendMessage({ type: "rearvy:openOptions" });
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
  void refreshStatus();
  setInterval(() => void refreshStatus(), 3000);
})();
