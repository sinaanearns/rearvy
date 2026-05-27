import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseBrowserConnectionMethod,
  normalizeCdpProbeResponse,
  normalizeExtensionRelayStatus,
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
});

test("normalizeCdpProbeResponse marks invalid payloads disconnected", () => {
  const result = normalizeCdpProbeResponse(null, 9222);

  assert.equal(result.connected, false);
  assert.equal(result.method, "cdp-direct");
  assert.match(result.error || "", /JSON object/);
});

test("normalizeExtensionRelayStatus flattens relay heartbeat state", () => {
  const result = normalizeExtensionRelayStatus(
    {
      connected: true,
      extension: {
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
