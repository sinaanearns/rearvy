import test from "node:test";
import assert from "node:assert/strict";

import { mergeReplayMessages } from "./history-replay.ts";

test("mergeReplayMessages restores older Firestore turns when incoming messages are partial", () => {
  const merged = mergeReplayMessages({
    persistedMessages: [
      {
        id: "user-1",
        role: "user",
        content: "Remember my store sells notebooks.",
        parts: [{ type: "text", text: "Remember my store sells notebooks." }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Noted.",
        parts: [{ type: "text", text: "Noted." }],
      },
    ],
    incomingMessages: [
      {
        id: "user-2",
        role: "user",
        parts: [{ type: "text", text: "What did I say my store sells?" }],
      },
    ],
  });

  assert.deepEqual(
    merged.map((message) => message.id),
    ["user-1", "assistant-1", "user-2"]
  );
});

test("mergeReplayMessages prefers incoming live tool output over persisted input-only tool state", () => {
  const merged = mergeReplayMessages({
    persistedMessages: [
      {
        id: "assistant-browser",
        role: "assistant",
        content: null,
        parts: [
          {
            type: "dynamic-tool",
            toolCallId: "browser-1",
            toolName: "requestBrowserConnection",
            input: { task: "signup for Shopify" },
            state: "input-available",
          },
        ],
      },
    ],
    incomingMessages: [
      {
        id: "assistant-browser",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolCallId: "browser-1",
            toolName: "requestBrowserConnection",
            output: { status: "connected", method: "extension-relay" },
            state: "output-available",
          },
        ],
      },
    ],
  });

  const parts = merged[0].parts as Array<Record<string, unknown>>;
  assert.deepEqual(parts[0].input, { task: "signup for Shopify" });
  assert.deepEqual(parts[0].output, {
    status: "connected",
    method: "extension-relay",
  });
});

test("mergeReplayMessages does not duplicate a just-persisted current user message", () => {
  const merged = mergeReplayMessages({
    persistedMessages: [
      {
        id: "generated-doc-id",
        role: "user",
        content: "continue",
        parts: [{ type: "text", text: "continue" }],
      },
    ],
    incomingMessages: [
      {
        role: "user",
        parts: [{ type: "text", text: "continue" }],
      },
    ],
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, undefined);
});

test("mergeReplayMessages drops empty assistant placeholders", () => {
  const merged = mergeReplayMessages({
    persistedMessages: [
      {
        id: "assistant-empty",
        role: "assistant",
        content: null,
        parts: [],
      },
    ],
    incomingMessages: [],
  });

  assert.deepEqual(merged, []);
});
