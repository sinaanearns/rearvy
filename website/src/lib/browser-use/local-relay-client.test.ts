import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLocalRelaySetupUrl,
  canUseLocalRelayBridge,
  createLocalRelayBrowserBridge,
  isLocalRearvyHost,
} from "./local-relay-client";

test("local relay bridge is only enabled for localhost-style origins", () => {
  assert.equal(isLocalRearvyHost("localhost"), true);
  assert.equal(isLocalRearvyHost("127.0.0.1"), true);
  assert.equal(isLocalRearvyHost("[::1]"), true);
  assert.equal(isLocalRearvyHost("www.rearvy.com"), false);

  assert.equal(
    canUseLocalRelayBridge({ protocol: "http:", hostname: "localhost" }),
    true
  );
  assert.equal(
    canUseLocalRelayBridge({ protocol: "https:", hostname: "www.rearvy.com" }),
    false
  );
});

test("local relay bridge maps relay status into browser connection status", async () => {
  const calls: string[] = [];
  const bridge = createLocalRelayBrowserBridge({
    location: { protocol: "http:", hostname: "localhost" },
    relayPort: 48732,
    openWindow: () => null,
    fetchImpl: (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({
          ok: true,
          port: 48732,
          connected: true,
          extension: {
            connected: true,
            active: false,
            trusted: true,
            stale: true,
            id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            version: "0.1.8",
            tabCount: 2,
            lastSeenAt: "2026-06-04T00:00:00.000Z",
          },
        })
      );
    }) as typeof fetch,
  });

  assert.ok(bridge);
  const status = await bridge.getConnectionStatus();

  assert.equal(status.extensionRelay?.connected, true);
  assert.equal(status.extensionRelay?.active, false);
  assert.equal(status.extensionRelay?.trusted, true);
  assert.equal(status.extensionRelay?.stale, true);
  assert.equal(status.extensionRelay?.extensionId, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(status.extensionRelay?.tabCount, 2);
  assert.equal(status.recommendedMethod, "extension-relay");
  assert.deepEqual(calls, ["http://127.0.0.1:48732/status"]);
});

test("local relay bridge opens setup page with pairing details", async () => {
  let openedUrl = "";
  const bridge = createLocalRelayBrowserBridge({
    location: { protocol: "http:", hostname: "127.0.0.1" },
    relayPort: 48732,
    openWindow: (url) => {
      openedUrl = String(url);
      return null;
    },
    fetchImpl: (async () => new Response("{}")) as typeof fetch,
  });

  assert.ok(bridge);
  await bridge.openExtensionOptions({
    pairingCode: "abc123",
    relayUrl: "http://127.0.0.1:48732",
  });

  assert.equal(
    openedUrl,
    buildLocalRelaySetupUrl("http://127.0.0.1:48732", {
      pairingCode: "abc123",
      relayUrl: "http://127.0.0.1:48732",
    })
  );
  assert.equal(
    openedUrl,
    "http://127.0.0.1:48732/browser-relay/setup?pairingCode=ABC123&relayUrl=http%3A%2F%2F127.0.0.1%3A48732"
  );
});
