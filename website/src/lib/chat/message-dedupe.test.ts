import test from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";

import { dedupeMessagesForDisplay } from "./message-dedupe.ts";

function userMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  } as UIMessage;
}

function mediaMessage(id: string, prompt: string): UIMessage {
  return {
    id,
    role: "assistant",
    metadata: { manualMediaGeneration: true },
    parts: [
      {
        type: "dynamic-tool",
        toolCallId: `generateMedia-${id}`,
        toolName: "generateMedia",
        state: "output-available",
        input: { mode: "image", prompt },
        output: {
          ok: true,
          mode: "image",
          prompt,
          originalPrompt: prompt,
          presentation: "design",
          images: [`https://example.com/${id}.png`],
        },
      },
    ],
  } as UIMessage;
}

test("dedupeMessagesForDisplay collapses repeated manual media responses in one turn", () => {
  const messages = [
    userMessage("user-1", "Design a logo for Veloria"),
    mediaMessage("assistant-1", "Design a logo for Veloria"),
    mediaMessage("assistant-2", "Design a logo for Veloria"),
  ];

  assert.deepEqual(
    dedupeMessagesForDisplay(messages).map((message) => message.id),
    ["user-1", "assistant-1"]
  );
});

test("dedupeMessagesForDisplay allows the same prompt after a new user turn", () => {
  const messages = [
    userMessage("user-1", "Design a logo for Veloria"),
    mediaMessage("assistant-1", "Design a logo for Veloria"),
    userMessage("user-2", "Try the same prompt again"),
    mediaMessage("assistant-2", "Design a logo for Veloria"),
  ];

  assert.deepEqual(
    dedupeMessagesForDisplay(messages).map((message) => message.id),
    ["user-1", "assistant-1", "user-2", "assistant-2"]
  );
});

test("dedupeMessagesForDisplay removes repeated message ids", () => {
  const messages = [
    userMessage("user-1", "Hello"),
    mediaMessage("assistant-1", "First streamed state"),
    mediaMessage("assistant-1", "Latest streamed state"),
  ];

  assert.deepEqual(
    dedupeMessagesForDisplay(messages).map((message) => message.id),
    ["user-1", "assistant-1"]
  );
  const latestPart = dedupeMessagesForDisplay(messages)[1]?.parts[0] as {
    input?: { prompt?: string };
  } | undefined;
  assert.equal(
    latestPart?.input?.prompt,
    "Latest streamed state"
  );
});
