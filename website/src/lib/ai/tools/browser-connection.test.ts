import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRequestBrowserConnectionInput,
  normalizeRequestBrowserConnectionOutput,
} from "./browser-connection.ts";

test("normalizeRequestBrowserConnectionInput applies defaults", () => {
  const input = normalizeRequestBrowserConnectionInput({
    task: "Sign up for example.com",
  });

  assert.equal(input.task, "Sign up for example.com");
  assert.equal(input.preferredMethod, "cdp-direct");
  assert.deepEqual(input.allowedMethods, ["cdp-direct", "extension-relay"]);
  assert.equal(input.requireFunctionalControl, true);
});

test("normalizeRequestBrowserConnectionInput accepts method constraints", () => {
  const input = normalizeRequestBrowserConnectionInput({
    task: "Open the signup page",
    reason: "Need a connected browser before filling forms.",
    preferredMethod: "extension-relay",
    allowedMethods: ["extension-relay"],
    requireFunctionalControl: false,
  });

  assert.equal(input.preferredMethod, "extension-relay");
  assert.deepEqual(input.allowedMethods, ["extension-relay"]);
  assert.equal(input.requireFunctionalControl, false);
});

test("normalizeRequestBrowserConnectionOutput keeps connection metadata", () => {
  const output = normalizeRequestBrowserConnectionOutput({
    status: "connected",
    method: "cdp-direct",
    connectedBrowser: {
      name: "Chrome/144.0.0.0",
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/test",
    },
    connectionMetadata: {
      port: 9222,
      tabCount: 3,
    },
  });

  assert.equal(output.status, "connected");
  assert.equal(output.method, "cdp-direct");
  assert.equal(output.connectedBrowser?.name, "Chrome/144.0.0.0");
  assert.equal(output.connectionMetadata?.port, 9222);
});
