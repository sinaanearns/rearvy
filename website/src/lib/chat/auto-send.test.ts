import test from "node:test";
import assert from "node:assert/strict";
import type { UIMessage } from "ai";

import { lastAssistantMessageIsCompleteWithClientToolCalls } from "./auto-send.ts";

test("completed generateMedia output does not trigger automatic continuation", () => {
  const messages = [
    {
      id: "assistant-media",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "generateMedia-1",
          toolName: "generateMedia",
          state: "output-available",
          output: { ok: true, mode: "image", images: ["https://example.com/logo.png"] },
        },
      ],
    },
  ] as UIMessage[];

  assert.equal(lastAssistantMessageIsCompleteWithClientToolCalls({ messages }), false);
});

test("completed client continuation tool output triggers automatic continuation", () => {
  const messages = [
    {
      id: "assistant-browser",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "browser-1",
          toolName: "requestBrowserConnection",
          state: "output-available",
          output: { status: "connected" },
        },
      ],
    },
  ] as UIMessage[];

  assert.equal(lastAssistantMessageIsCompleteWithClientToolCalls({ messages }), true);
});

test("provider-executed client tools do not trigger browser-side continuation", () => {
  const messages = [
    {
      id: "assistant-browser",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "browser-1",
          toolName: "requestBrowserConnection",
          state: "output-available",
          output: { status: "connected" },
          providerExecuted: true,
        },
      ],
    },
  ] as UIMessage[];

  assert.equal(lastAssistantMessageIsCompleteWithClientToolCalls({ messages }), false);
});
