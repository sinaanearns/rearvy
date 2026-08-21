import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseBrowserConnectionMethod,
  normalizeCdpProbeResponse,
  normalizeExtensionRelayStatus,
  normalizeWebSocketDebuggerUrl,
} from "./connection.ts";

test("normalizeCdpProbeResponse detects browser remote debugging", () => {
  const result = normalizeCdpProbeResponse(
    {
      Browser: "Chrome/144.0.0.0",
      "Protocol-Version": "1.3",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/test",
    },
    9222
  );

  assert.equal(result.connected, true);
  assert.equal(result.method, "cdp-direct");
  assert.equal(result.port, 9222);
  assert.equal(result.browser, "Chrome/144.0.0.0");
  assert.equal(result.protocolVersion, "1.3");
  assert.equal(
    result.webSocketDebuggerUrl,
    "ws://127.0.0.1:9222/devtools/browser/test"
  );
});

test("normalizeCdpProbeResponse marks invalid payloads disconnected", () => {
  const result = normalizeCdpProbeResponse(null, 9222);

  assert.equal(result.connected, false);
  assert.equal(result.method, "cdp-direct");
  assert.match(result.error || "", /JSON object/);
});

test("normalizeCdpProbeResponse rejects unsafe debugger websocket urls", () => {
  const result = normalizeCdpProbeResponse(
    {
      webSocketDebuggerUrl: "https://example.com/devtools/browser/test",
    },
    9222
  );

  assert.equal(result.connected, false);
  assert.equal(result.webSocketDebuggerUrl, undefined);
});

test("normalizeWebSocketDebuggerUrl accepts only websocket debugger urls", () => {
  assert.equal(
    normalizeWebSocketDebuggerUrl(" ws://127.0.0.1:9222/devtools/browser/test "),
    "ws://127.0.0.1:9222/devtools/browser/test"
  );
  assert.equal(
    normalizeWebSocketDebuggerUrl("wss://debug.example.com/devtools/browser/test"),
    "wss://debug.example.com/devtools/browser/test"
  );
  assert.equal(normalizeWebSocketDebuggerUrl("http://127.0.0.1:9222/json"), null);
  assert.equal(
    normalizeWebSocketDebuggerUrl("ws://user:pass@127.0.0.1:9222/devtools"),
    null
  );
  assert.equal(
    normalizeWebSocketDebuggerUrl("ws://127.0.0.1:9222/devtools\nbrowser"),
    null
  );
});

test("normalizeExtensionRelayStatus flattens relay heartbeat state", () => {
  const result = normalizeExtensionRelayStatus(
    {
      connected: true,
      extension: {
        active: false,
        trusted: true,
        stale: true,
        id: "ext-1",
        version: "0.1.0",
        tabCount: 2,
        lastSeenAt: "2026-05-26T00:00:00.000Z",
      },
      pairingCode: "ABC123",
    },
    48732
  );

  assert.equal(result.connected, true);
  assert.equal(result.active, false);
  assert.equal(result.trusted, true);
  assert.equal(result.stale, true);
  assert.equal(result.method, "extension-relay");
  assert.equal(result.port, 48732);
  assert.equal(result.extensionId, "ext-1");
  assert.equal(result.tabCount, 2);
  assert.equal(result.pairingCode, "ABC123");
});

test("chooseBrowserConnectionMethod prefers CDP, then extension, then managed runner", () => {
  assert.equal(
    chooseBrowserConnectionMethod({
      cdpDirect: { connected: true },
      extensionRelay: { connected: true },
    }),
    "cdp-direct"
  );

  assert.equal(
    chooseBrowserConnectionMethod({
      cdpDirect: { connected: false },
      extensionRelay: { connected: true },
    }),
    "extension-relay"
  );

  assert.equal(
    chooseBrowserConnectionMethod({
      cdpDirect: { connected: false },
      extensionRelay: { connected: false },
    }),
    "managed-runner"
  );
});

test("chooseBrowserConnectionMethod respects allowed methods", () => {
  assert.equal(
    chooseBrowserConnectionMethod({
      cdpDirect: { connected: true },
      extensionRelay: { connected: true },
      allowedMethods: ["extension-relay"],
    }),
    "extension-relay"
  );

  assert.equal(
    chooseBrowserConnectionMethod({
      cdpDirect: { connected: false },
      extensionRelay: { connected: false },
      allowedMethods: ["cdp-direct", "extension-relay"],
    }),
    "extension-relay"
  );
});
