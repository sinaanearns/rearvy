import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeRequestBrowserConnectionInput,
  normalizeRequestBrowserConnectionOutput,
} from "./browser-connection.ts";

test("normalizeRequestBrowserConnectionInput applies defaults", () => {
  const input = normalizeRequestBrowserConnectionInput({
    task: " Sign up\nfor example.com ",
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

test("normalizeRequestBrowserConnectionInput trims and bounds text fields", () => {
  const input = normalizeRequestBrowserConnectionInput({
    task: "t".repeat(1100),
    reason: " Need it\tfor the task. ",
  });

  assert.equal(input.task.length, 1000);
  assert.equal(input.reason, "Need it for the task.");
});

test("normalizeRequestBrowserConnectionOutput keeps connection metadata", () => {
  const output = normalizeRequestBrowserConnectionOutput({
    status: "connected",
    method: "cdp-direct",
    message: " Connected\n ",
    connectedBrowser: {
      name: " Chrome\nCanary ",
      version: " 144.0.0.0\t ",
      webSocketDebuggerUrl: " ws://127.0.0.1:9222/devtools/browser/test ",
    },
    connectionMetadata: {
      port: 9222,
      relayPort: 48732,
      extensionId: " rearvy-extension\n ",
      tabCount: 3,
      nested: { keep: false },
    },
    respondedAt: "2026-06-11T10:00:00.000Z",
  });

  assert.equal(output.status, "connected");
  assert.equal(output.method, "cdp-direct");
  assert.equal(output.message, "Connected");
  assert.equal(output.connectedBrowser?.name, "Chrome Canary");
  assert.equal(output.connectedBrowser?.version, "144.0.0.0");
  assert.equal(
    output.connectedBrowser?.webSocketDebuggerUrl,
    "ws://127.0.0.1:9222/devtools/browser/test"
  );
  assert.equal(output.connectionMetadata?.port, 9222);
  assert.equal(output.connectionMetadata?.relayPort, 48732);
  assert.equal(output.connectionMetadata?.extensionId, "rearvy-extension");
  assert.equal(output.connectionMetadata?.tabCount, 3);
  assert.equal(output.respondedAt, "2026-06-11T10:00:00.000Z");
  assert.equal(
    Object.prototype.hasOwnProperty.call(output.connectionMetadata ?? {}, "nested"),
    false
  );
});

test("normalizeRequestBrowserConnectionOutput rejects unsafe debugger websocket URLs", () => {
  const output = normalizeRequestBrowserConnectionOutput({
    status: "connected",
    method: "cdp-direct",
    connectedBrowser: {
      name: "Chrome/144.0.0.0",
      webSocketDebuggerUrl: "https://example.com/devtools/browser/test",
    },
  });

  assert.equal(output.connectedBrowser?.webSocketDebuggerUrl, undefined);
});

test("normalizeRequestBrowserConnectionOutput drops malformed connection metadata", () => {
  const output = normalizeRequestBrowserConnectionOutput({
    status: "connected",
    method: "extension-relay",
    connectionMetadata: {
      relayPort: 70000,
      port: 0,
      extensionId: " \n ",
      tabCount: -1,
      unexpected: "value",
    },
  });

  assert.deepEqual(output.connectionMetadata, {});
});

test("normalizeRequestBrowserConnectionOutput drops malformed output text and timestamps", () => {
  const output = normalizeRequestBrowserConnectionOutput({
    status: "failed",
    message: 42,
    connectedBrowser: {
      name: " \n ",
      version: {},
      webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/test",
    },
    respondedAt: "not a date",
  });

  assert.equal(output.message, undefined);
  assert.deepEqual(output.connectedBrowser, {
    webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/test",
  });
  assert.equal(output.respondedAt, undefined);
});

test("normalizeRequestBrowserConnectionOutput truncates long output text", () => {
  const output = normalizeRequestBrowserConnectionOutput({
    status: "skipped",
    message: "m".repeat(1100),
    connectedBrowser: {
      name: "n".repeat(140),
      version: "v".repeat(140),
    },
  });

  assert.equal(output.message?.length, 1000);
  assert.equal(output.connectedBrowser?.name?.length, 120);
  assert.equal(output.connectedBrowser?.version?.length, 120);
});
