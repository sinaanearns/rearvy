import test from "node:test";
import assert from "node:assert/strict";

import {
  findBrowserConnectionOutputInfoInMessage,
  findLatestBrowserConnectionOutputInfo,
  getBrowserConnectionStatus,
  hasBrowserTaskForConnection,
  isMissingBrowserContinuationTask,
  resolveBrowserTaskText,
} from "./browser-continuation.ts";

test("resolveBrowserTaskText recovers browser continuation task from connection input", () => {
  const taskText = resolveBrowserTaskText({
    effectiveUserText: "",
    isBrowserConnectionContinuation: true,
    browserConnectionInput: { task: " signup\nfor Shopify " },
  });

  assert.equal(taskText, "signup for Shopify");
  assert.equal(getBrowserConnectionStatus({ status: "connected" }), "connected");
  assert.equal(
    isMissingBrowserContinuationTask({
      isBrowserConnectionContinuation: true,
      browserConnectionOutput: { status: "connected" },
      browserTaskText: taskText,
    }),
    false
  );
});

test("resolveBrowserTaskText supports legacy requestedAction browser input", () => {
  const taskText = resolveBrowserTaskText({
    effectiveUserText: "",
    isBrowserConnectionContinuation: true,
    browserConnectionInput: { requestedAction: " open Shopify\tsignup " },
  });

  assert.equal(taskText, "open Shopify signup");
});

test("resolveBrowserTaskText drops invalid browser continuation input", () => {
  const taskText = resolveBrowserTaskText({
    effectiveUserText: "",
    isBrowserConnectionContinuation: true,
    browserConnectionInput: { task: " \n " },
  });

  assert.equal(taskText, "");
});

test("hasBrowserTaskForConnection detects duplicate browser task continuations", () => {
  assert.equal(
    hasBrowserTaskForConnection(
      [
        {
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "runBrowserTask",
              toolCallId: "browser-task-1",
              input: {
                task: "Open Shopify.",
                browserConnectionToolCallId: "connection-1",
              },
              output: { ok: true },
            },
          ],
        },
      ],
      "connection-1"
    ),
    true
  );
});

test("findLatestBrowserConnectionOutputInfo sanitizes fresh browser connection output", () => {
  const info = findLatestBrowserConnectionOutputInfo([
    {
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "requestBrowserConnection",
          toolCallId: "connection-1",
          input: { task: "Open Shopify." },
          output: {
            status: "connected",
            method: "cdp-direct",
            message: " Connected\n ",
            connectedBrowser: {
              name: " Chrome\nCanary ",
              webSocketDebuggerUrl: "https://example.com/devtools/browser/test",
            },
            connectionMetadata: {
              port: 9222,
              relayPort: 70000,
              extensionId: " rearvy-extension\t ",
              unexpected: "value",
            },
            respondedAt: "not a date",
          },
        },
      ],
    },
  ]);

  assert.deepEqual(info?.output, {
    status: "connected",
    method: "cdp-direct",
    message: "Connected",
    connectedBrowser: {
      name: "Chrome Canary",
    },
    connectionMetadata: {
      port: 9222,
      extensionId: "rearvy-extension",
    },
  });
});

test("findBrowserConnectionOutputInfoInMessage falls back for invalid fresh browser output", () => {
  const info = findBrowserConnectionOutputInfoInMessage({
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: "requestBrowserConnection",
        toolCallId: "connection-1",
        input: { task: "Open Shopify." },
        output: {
          status: "done",
          method: "cdp-direct",
        },
      },
    ],
  });

  assert.deepEqual(info?.output, {
    status: "failed",
    message: "Browser connection returned an invalid response.",
  });
  assert.equal(getBrowserConnectionStatus(info?.output), "failed");
});

test("isMissingBrowserContinuationTask blocks model fallback when connection task is missing", () => {
  const taskText = resolveBrowserTaskText({
    effectiveUserText: "signup for Shopify",
    isBrowserConnectionContinuation: true,
    browserConnectionInput: null,
  });

  assert.equal(taskText, "");
  assert.equal(
    isMissingBrowserContinuationTask({
      isBrowserConnectionContinuation: true,
      browserConnectionOutput: { status: "connected" },
      browserTaskText: taskText,
    }),
    true
  );
});
