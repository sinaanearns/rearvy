import test from "node:test";
import assert from "node:assert/strict";

import {
  getBrowserConnectionCardDisplay,
  resolveBrowserConnectionMethod,
} from "./browser-connection-rendering";

test("pending browser connection renders the full card", () => {
  const parts = [
    {
      type: "dynamic-tool",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      state: "input-available",
      input: { task: "Sign up for example.com" },
    },
  ];

  assert.equal(getBrowserConnectionCardDisplay(parts, 0), "full");
});

test("completed browser connection without a later browser task renders compact", () => {
  const parts = [
    {
      type: "dynamic-tool",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      state: "output-available",
      input: { task: "Sign up for example.com" },
      output: { status: "connected", method: "cdp-direct" },
    },
  ];

  assert.equal(getBrowserConnectionCardDisplay(parts, 0), "compact");
});

test("completed browser connection followed by a browser task is hidden", () => {
  const parts = [
    {
      type: "dynamic-tool",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      state: "output-available",
      input: { task: "Sign up for example.com" },
      output: { status: "connected", method: "extension-relay" },
    },
    {
      type: "dynamic-tool",
      toolCallId: "browser-task-1",
      toolName: "runBrowserTask",
      state: "output-available",
      input: { task: "Open Shopify signup" },
      output: { ok: true, browserSessionId: "session-1" },
    },
  ];

  assert.equal(getBrowserConnectionCardDisplay(parts, 0), "hidden");
});

test("completed extension relay output chooses extension-relay", () => {
  const method = resolveBrowserConnectionMethod(
    { preferredMethod: "cdp-direct" },
    { status: "connected", method: "extension-relay" }
  );

  assert.equal(method, "extension-relay");
});
