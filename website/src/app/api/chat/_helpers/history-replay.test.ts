import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeReplayMessages,
  normalizeIncomingReplayMessages,
} from "./history-replay.ts";

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
  assert.deepEqual(parts[0].input, {
    task: "signup for Shopify",
    preferredMethod: "cdp-direct",
    allowedMethods: ["cdp-direct", "extension-relay"],
    requireFunctionalControl: true,
  });
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

test("normalizeIncomingReplayMessages sanitizes fresh askUser output", () => {
  const messages = normalizeIncomingReplayMessages([
    {
      id: "assistant-ask",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "ask-1",
          toolName: "askUser",
          input: {
            purpose: "signup_account_identifier",
            prompt: " Which email\nshould I use? ",
            requestedAction: " Sign up\nfor Shopify ",
          },
          state: "output-available",
          output: {
            status: "answered",
            answer: " Use\nexample.com ",
            respondedAt: "not a date",
          },
        },
      ],
    },
  ]);

  const parts = messages[0].parts as Array<Record<string, unknown>>;
  assert.deepEqual(parts[0].input, {
    kind: "clarification",
    purpose: "signup_account_identifier",
    prompt: "Which email should I use?",
    allowSkip: true,
    sensitive: false,
    requestedAction: "Sign up for Shopify",
  });
  assert.deepEqual(parts[0].output, {
    status: "answered",
    answer: "Use example.com",
  });
  assert.equal("result" in parts[0], false);
});

test("normalizeIncomingReplayMessages falls back for invalid fresh askUser output", () => {
  const messages = normalizeIncomingReplayMessages([
    {
      id: "assistant-ask",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "ask-1",
          toolName: "askUser",
          input: { prompt: "Which service should I use?" },
          state: "output-available",
          result: {
            status: "done",
            answer: "Use example.com",
          },
        },
      ],
    },
  ]);

  const parts = messages[0].parts as Array<Record<string, unknown>>;
  assert.deepEqual(parts[0].output, { status: "skipped" });
  assert.equal("result" in parts[0], false);
});

test("normalizeIncomingReplayMessages falls back to legacy askUser prompt fields", () => {
  const messages = normalizeIncomingReplayMessages([
    {
      id: "assistant-ask",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "ask-1",
          toolName: "askUser",
          input: {
            question: " Which service\nshould I use? ",
          },
          state: "input-available",
        },
      ],
    },
  ]);

  const parts = messages[0].parts as Array<Record<string, unknown>>;
  assert.deepEqual(parts[0].input, {
    prompt: "Which service should I use?",
  });
});

test("normalizeIncomingReplayMessages sanitizes fresh browser connection output", () => {
  const messages = normalizeIncomingReplayMessages([
    {
      id: "assistant-browser",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "browser-1",
          toolName: "requestBrowserConnection",
          input: {
            task: " Open Shopify\nsignup ",
            reason: " Need browser\tcontrol. ",
          },
          state: "output-available",
          output: {
            status: "connected",
            method: "extension-relay",
            message: " Connected\n ",
            connectedBrowser: {
              name: " Chrome\nCanary ",
              version: " 126.0 ",
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

  const parts = messages[0].parts as Array<Record<string, unknown>>;
  assert.deepEqual(parts[0].input, {
    task: "Open Shopify signup",
    reason: "Need browser control.",
    preferredMethod: "cdp-direct",
    allowedMethods: ["cdp-direct", "extension-relay"],
    requireFunctionalControl: true,
  });
  assert.deepEqual(parts[0].output, {
    status: "connected",
    method: "extension-relay",
    message: "Connected",
    connectedBrowser: {
      name: "Chrome Canary",
      version: "126.0",
    },
    connectionMetadata: {
      port: 9222,
      extensionId: "rearvy-extension",
    },
  });
});

test("normalizeIncomingReplayMessages falls back for invalid fresh browser connection output", () => {
  const messages = normalizeIncomingReplayMessages([
    {
      id: "assistant-browser",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "browser-1",
          toolName: "requestBrowserConnection",
          input: { task: "Open Shopify signup" },
          state: "output-available",
          result: {
            status: "done",
            method: "extension-relay",
          },
        },
      ],
    },
  ]);

  const parts = messages[0].parts as Array<Record<string, unknown>>;
  assert.deepEqual(parts[0].output, {
    status: "failed",
    message: "Browser connection returned an invalid response.",
  });
  assert.equal("result" in parts[0], false);
});
