const pairingCode = document.getElementById("pairingCode");
const relayUrl = document.getElementById("relayUrl");
const statusEl = document.getElementById("status");
const save = document.getElementById("save");

function renderStatus(data) {
  if (data.connected) {
    statusEl.textContent = `Connected. Last seen ${data.lastSeenAt || "now"}.`;
    return;
  }
  statusEl.textContent = data.lastError
    ? `Not connected: ${data.lastError}`
    : "Not connected yet.";
}

chrome.storage.local.get(
  ["pairingCode", "relayUrl", "connected", "lastError", "lastSeenAt"],
  (data) => {
    pairingCode.value = data.pairingCode || "";
    relayUrl.value = data.relayUrl || "http://127.0.0.1:48732";
    renderStatus(data);
  }
);

save.addEventListener("click", () => {
  chrome.storage.local.set(
    {
      pairingCode: pairingCode.value.trim().toUpperCase(),
      relayUrl: relayUrl.value.trim() || "http://127.0.0.1:48732",
      lastError: "",
    },
    () => {
      statusEl.textContent = "Saved. The extension will connect within a few seconds.";
    }
  );
});

setInterval(() => {
  chrome.storage.local.get(["connected", "lastError", "lastSeenAt"], renderStatus);
}, 1500);
