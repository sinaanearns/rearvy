const DEFAULT_RELAY_URL = "http://127.0.0.1:48732";
const HEARTBEAT_MS = 2500;
const POLL_MS = 1000;

let connected = false;

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

function storageSet(values) {
  return chrome.storage.local.set(values);
}

async function relayUrl() {
  const data = await storageGet(["relayUrl"]);
  return data.relayUrl || DEFAULT_RELAY_URL;
}

async function relayEnabled() {
  const data = await storageGet(["relayEnabled", "pairingCode"]);
  if (typeof data.relayEnabled === "boolean") {
    return data.relayEnabled;
  }
  return Boolean(data.pairingCode);
}

async function updateActionState() {
  const enabled = await relayEnabled();
  const title = enabled
    ? connected
      ? "Rearvy Browser Relay is connected"
      : "Rearvy Browser Relay is connecting"
    : "Rearvy Browser Relay is off";

  await chrome.action.setTitle({ title });
}

function normalizeRearvyUrl(value) {
  const fallback = "https://rearvy.com/chat";
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;

  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {}

  return fallback;
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
  } catch {}

  return "";
}

function rearvyUrlFromContext(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isRearvyHost =
      host === "rearvy.com" ||
      host.endsWith(".rearvy.com") ||
      host === "localhost" ||
      host === "127.0.0.1";

    if ((url.protocol === "http:" || url.protocol === "https:") && isRearvyHost) {
      return `${url.origin}/chat`;
    }
  } catch {}

  return "";
}

async function currentRelayStatus() {
  const data = await storageGet([
    "relayEnabled",
    "pairingCode",
    "connected",
    "lastError",
    "lastSeenAt",
    "relayUrl",
  ]);
  const enabled =
    typeof data.relayEnabled === "boolean"
      ? data.relayEnabled
      : Boolean(data.pairingCode);

  return {
    enabled,
    connected: enabled && Boolean(data.connected),
    pairingConfigured: Boolean(data.pairingCode),
    relayUrl: data.relayUrl || DEFAULT_RELAY_URL,
    lastError: typeof data.lastError === "string" ? data.lastError : "",
    lastSeenAt: typeof data.lastSeenAt === "string" ? data.lastSeenAt : "",
  };
}

async function setRelayEnabled(enabled) {
  connected = false;
  await storageSet({
    relayEnabled: Boolean(enabled),
    connected: false,
    lastError: "",
  });
  await updateActionState();

  if (enabled) {
    void heartbeat();
  }

  return { ok: true, status: await currentRelayStatus() };
}

async function openRearvy(contextUrl) {
  const data = await storageGet(["rearvyAppUrl"]);
  const url = normalizeRearvyUrl(data.rearvyAppUrl || rearvyUrlFromContext(contextUrl));
  const target = new URL(url);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => {
    if (!tab.url) {
      return false;
    }

    try {
      return new URL(tab.url).origin === target.origin;
    } catch {
      return false;
    }
  });

  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    return { ok: true, tabId: existing.id, url: existing.url || url };
  }

  const created = await chrome.tabs.create({ url, active: true });
  return { ok: true, tabId: created.id, url };
}

async function postJson(path, body) {
  const baseUrl = await relayUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Relay returned HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    error.pairingRequired = payload.pairingRequired === true;
    throw error;
  }
  return payload;
}

async function getJson(path) {
  const baseUrl = await relayUrl();
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Relay returned HTTP ${response.status}`);
  }
  return payload;
}

async function listTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map((tab) => ({
    id: tab.id,
    title: tab.title || "",
    url: tab.url || "",
    active: Boolean(tab.active),
  }));
}

async function createFreshPairingCode() {
  const payload = await postJson("/pairing-code", {});
  const nextPairingCode = normalizePairingCode(payload.pairingCode);

  if (!nextPairingCode) {
    throw new Error("Rearvy Desktop did not return a pairing code.");
  }

  const nextRelayUrl =
    typeof payload.port === "number" && payload.port > 0
      ? `http://127.0.0.1:${payload.port}`
      : await relayUrl();

  await storageSet({
    pairingCode: nextPairingCode,
    relayUrl: nextRelayUrl,
    relayEnabled: true,
    connected: false,
    lastError: "",
  });

  return nextPairingCode;
}

async function applyPairingRequest(input) {
  const nextPairingCode = normalizePairingCode(input?.pairingCode);
  const nextRelayUrl = normalizeRelayUrl(input?.relayUrl) || DEFAULT_RELAY_URL;

  if (!nextPairingCode) {
    return { ok: false, error: "Pairing code is missing." };
  }

  await storageSet({
    pairingCode: nextPairingCode,
    relayUrl: nextRelayUrl,
    relayEnabled: true,
    connected: false,
    lastError: "",
  });
  await updateActionState();
  await heartbeat(false);

  const status = await currentRelayStatus();
  if (!status.connected) {
    return {
      ok: false,
      error: status.lastError || "Pairing code was saved, but the relay is not connected yet.",
      status,
    };
  }

  return { ok: true, status };
}

async function postHeartbeat(pairingCode) {
  return await postJson("/extension/heartbeat", {
    extensionId: chrome.runtime.id,
    version: chrome.runtime.getManifest().version,
    pairingCode: pairingCode || "",
    tabs: await listTabs(),
  });
}

async function markHeartbeatConnected() {
  connected = true;
  await storageSet({
    connected: true,
    lastError: "",
    lastSeenAt: new Date().toISOString(),
  });
  await updateActionState();
}

async function heartbeat(allowPairingRefresh = true) {
  if (!(await relayEnabled())) {
    connected = false;
    await storageSet({ connected: false, lastError: "" });
    await updateActionState();
    return;
  }

  const data = await storageGet(["pairingCode"]);
  try {
    await postHeartbeat(data.pairingCode || "");
    await markHeartbeatConnected();
  } catch (error) {
    if (allowPairingRefresh && error?.pairingRequired) {
      try {
        const freshPairingCode = await createFreshPairingCode();
        await postHeartbeat(freshPairingCode);
        await markHeartbeatConnected();
        return;
      } catch (refreshError) {
        connected = false;
        await storageSet({
          connected: false,
          lastError:
            refreshError instanceof Error
              ? refreshError.message
              : String(refreshError),
        });
        await updateActionState();
        return;
      }
    }

    connected = false;
    await storageSet({
      connected: false,
      lastError: error instanceof Error ? error.message : String(error),
    });
    await updateActionState();
  }
}

async function activeTabId(preferredTabId) {
  if (typeof preferredTabId === "number") {
    return preferredTabId;
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs[0]?.id) {
    return tabs[0].id;
  }

  const allTabs = await chrome.tabs.query({});
  return allTabs[0]?.id || null;
}

async function runScript(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return result?.result ?? null;
}

async function executeCommand(command) {
  if (command.type === "navigate") {
    const targetUrl = String(command.url || command.target || "").trim();
    if (!targetUrl) {
      throw new Error("navigate requires a URL.");
    }
    const tabId = await activeTabId(command.tabId);
    if (tabId) {
      await chrome.tabs.update(tabId, { url: targetUrl, active: true });
      return { tabId, url: targetUrl };
    }
    const tab = await chrome.tabs.create({ url: targetUrl, active: true });
    return { tabId: tab.id, url: targetUrl };
  }

  if (command.type === "extract") {
    const tabId = await activeTabId(command.tabId);
    if (!tabId) {
      throw new Error("No active tab is available.");
    }
    return await runScript(tabId, () => ({
      title: document.title,
      url: location.href,
      text: document.body ? document.body.innerText.slice(0, 12000) : "",
    }));
  }

  if (command.type === "scanPage") {
    const tabId = await activeTabId(command.tabId);
    if (!tabId) {
      throw new Error("No active tab is available.");
    }
    return await runScript(tabId, () => {
      function visible(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      }

      function textOf(el) {
        return (
          el.innerText ||
          el.textContent ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.getAttribute("value") ||
          ""
        ).replace(/\s+/g, " ").trim();
      }

      function selectorFor(el) {
        if (el.id) {
          return `#${CSS.escape(el.id)}`;
        }

        const parts = [];
        let node = el;
        while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
          const tag = node.tagName.toLowerCase();
          const parent = node.parentElement;
          if (!parent) {
            parts.unshift(tag);
            break;
          }
          const siblings = Array.from(parent.children).filter(
            (item) => item.tagName === node.tagName
          );
          const index = siblings.indexOf(node) + 1;
          parts.unshift(`${tag}:nth-of-type(${Math.max(index, 1)})`);
          node = parent;
        }
        return parts.join(" > ");
      }

      const links = Array.from(document.querySelectorAll("a[href]"))
        .slice(0, 180)
        .map((el) => ({
          kind: "link",
          text: textOf(el),
          href: el.href || null,
          selector: selectorFor(el),
          visible: visible(el),
        }))
        .filter((item) => item.text || item.href);

      const buttons = Array.from(
        document.querySelectorAll(
          "button,[role='button'],input[type='button'],input[type='submit']"
        )
      )
        .slice(0, 160)
        .map((el) => ({
          kind: "button",
          text: textOf(el),
          selector: selectorFor(el),
          visible: visible(el),
        }))
        .filter((item) => item.text || item.selector);

      const forms = Array.from(document.querySelectorAll("form"))
        .slice(0, 30)
        .map((el) => ({
          kind: "form",
          text: textOf(el).slice(0, 500),
          selector: selectorFor(el),
          visible: visible(el),
        }));

      return {
        title: document.title,
        url: location.href,
        text: document.body ? document.body.innerText.slice(0, 24000) : "",
        links,
        buttons,
        forms,
        scroll: {
          x: window.scrollX,
          y: window.scrollY,
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
      };
    });
  }

  if (command.type === "scroll") {
    const tabId = await activeTabId(command.tabId);
    if (!tabId) {
      throw new Error("No active tab is available.");
    }
    const direction = String(command.direction || "down").toLowerCase();
    const amount = Number(command.amount || 800);
    return await runScript(
      tabId,
      (nextDirection, nextAmount) => {
        const amountValue = Number.isFinite(nextAmount) ? nextAmount : 800;
        if (nextDirection === "top") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (nextDirection === "bottom") {
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        } else if (nextDirection === "up") {
          window.scrollBy({ top: -amountValue, behavior: "smooth" });
        } else if (nextDirection === "left") {
          window.scrollBy({ left: -amountValue, behavior: "smooth" });
        } else if (nextDirection === "right") {
          window.scrollBy({ left: amountValue, behavior: "smooth" });
        } else {
          window.scrollBy({ top: amountValue, behavior: "smooth" });
        }
        return {
          x: window.scrollX,
          y: window.scrollY,
          height: document.documentElement.scrollHeight,
        };
      },
      [direction, amount]
    );
  }

  if (command.type === "captureVisible") {
    const tabId = await activeTabId(command.tabId);
    if (!tabId) {
      throw new Error("No active tab is available.");
    }
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    return { tabId, url: tab.url || "", title: tab.title || "", screenshot: dataUrl };
  }

  if (command.type === "click") {
    const tabId = await activeTabId(command.tabId);
    const selector = String(command.target || "").trim();
    if (!tabId || !selector) {
      throw new Error("click requires an active tab and selector.");
    }
    return await runScript(
      tabId,
      (nextSelector) => {
        const el = document.querySelector(nextSelector);
        if (!el) return { clicked: false, reason: "selector not found" };
        el.click();
        return { clicked: true };
      },
      [selector]
    );
  }

  if (command.type === "clickText") {
    const tabId = await activeTabId(command.tabId);
    const target = String(command.target || command.value || "").trim();
    if (!tabId || !target) {
      throw new Error("clickText requires an active tab and target text.");
    }
    return await runScript(
      tabId,
      (targetText) => {
        function normalized(value) {
          return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
        }

        function visible(el) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        }

        const needle = normalized(targetText);
        const candidates = Array.from(
          document.querySelectorAll("a,button,[role='button'],input[type='button'],input[type='submit']")
        );
        const match = candidates.find((el) => {
          if (!visible(el)) return false;
          const text = normalized(
            el.innerText ||
              el.textContent ||
              el.getAttribute("aria-label") ||
              el.getAttribute("title") ||
              el.getAttribute("value")
          );
          return text === needle || text.includes(needle) || needle.includes(text);
        });

        if (!match) {
          return { clicked: false, reason: "matching text not found" };
        }

        match.scrollIntoView({ block: "center", inline: "center" });
        match.click();
        return { clicked: true };
      },
      [target]
    );
  }

  if (command.type === "type") {
    const tabId = await activeTabId(command.tabId);
    const selector = String(command.target || "").trim();
    const value = String(command.value || "");
    if (!tabId || !selector) {
      throw new Error("type requires an active tab and selector.");
    }
    return await runScript(
      tabId,
      (nextSelector, nextValue) => {
        const el = document.querySelector(nextSelector);
        if (!el) return { typed: false, reason: "selector not found" };
        el.focus();
        el.value = nextValue;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { typed: true };
      },
      [selector, value]
    );
  }

  throw new Error(`Unsupported command: ${command.type}`);
}

async function poll() {
  if (!connected) {
    return;
  }

  try {
    const payload = await getJson(`/extension/poll?extensionId=${encodeURIComponent(chrome.runtime.id)}`);
    const command = payload.command;
    if (!command) {
      return;
    }
    try {
      const result = await executeCommand(command);
      await postJson("/extension/result", {
        commandId: command.id,
        ok: true,
        result,
      });
    } catch (error) {
      await postJson("/extension/result", {
        commandId: command.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch {
    connected = false;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await storageGet(["relayEnabled", "pairingCode", "relayUrl"]);
  const updates = {};

  if (!data.relayUrl) {
    updates.relayUrl = DEFAULT_RELAY_URL;
  }

  if (typeof data.relayEnabled !== "boolean") {
    updates.relayEnabled = Boolean(data.pairingCode);
  }

  if (Object.keys(updates).length > 0) {
    await storageSet(updates);
  }

  await updateActionState();
  void heartbeat();
});

chrome.runtime.onStartup.addListener(() => {
  void heartbeat();
});

chrome.action.onClicked.addListener(async () => {
  const enabled = await relayEnabled();
  connected = false;
  await storageSet({ relayEnabled: !enabled, connected: false, lastError: "" });
  await updateActionState();

  if (!enabled) {
    void heartbeat();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string" || !message.type.startsWith("rearvy:")) {
    return false;
  }

  (async () => {
    if (message.type === "rearvy:getRelayStatus") {
      return { ok: true, status: await currentRelayStatus() };
    }

    if (message.type === "rearvy:setRelayEnabled") {
      return await setRelayEnabled(Boolean(message.enabled));
    }

    if (message.type === "rearvy:openOptions") {
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    }

    if (message.type === "rearvy:openRearvy") {
      return await openRearvy(message.url);
    }

    if (message.type === "rearvy:applyPairingRequest") {
      return await applyPairingRequest(message);
    }

    return { ok: false, error: `Unsupported message: ${message.type}` };
  })()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return true;
});

setInterval(() => void heartbeat(), HEARTBEAT_MS);
setInterval(() => void poll(), POLL_MS);
void heartbeat();
