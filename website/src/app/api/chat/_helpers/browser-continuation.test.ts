import test from "node:test";
import assert from "node:assert/strict";

import {
  getBrowserConnectionStatus,
  hasBrowserTaskForConnection,
  isMissingBrowserContinuationTask,
  resolveBrowserTaskText,
} from "./browser-continuation.ts";

test("resolveBrowserTaskText recovers browser continuation task from connection input", () => {
  const taskText = resolveBrowserTaskText({
    effectiveUserText: "",
    isBrowserConnectionContinuation: true,
    browserConnectionInput: { task: "signup for Shopify" },
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
