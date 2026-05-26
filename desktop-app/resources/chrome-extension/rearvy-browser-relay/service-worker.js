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

async function postJson(path, body) {
  const baseUrl = await relayUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Relay returned HTTP ${response.status}`);
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

async function heartbeat() {
  const data = await storageGet(["pairingCode"]);
  try {
    await postJson("/extension/heartbeat", {
      extensionId: chrome.runtime.id,
      version: chrome.runtime.getManifest().version,
      pairingCode: data.pairingCode || "",
      tabs: await listTabs(),
    });
    connected = true;
    await storageSet({ connected: true, lastError: "", lastSeenAt: new Date().toISOString() });
  } catch (error) {
    connected = false;
    await storageSet({
      connected: false,
      lastError: error instanceof Error ? error.message : String(error),
    });
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

chrome.runtime.onInstalled.addListener(() => {
  void heartbeat();
});

setInterval(() => void heartbeat(), HEARTBEAT_MS);
setInterval(() => void poll(), POLL_MS);
void heartbeat();
