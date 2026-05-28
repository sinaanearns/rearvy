import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeStoredParts,
  repairAssistantMessagesForModelReplay,
} from "./message-normalization.ts";

test("normalizeStoredParts preserves pending askUser tool calls", () => {
  const parts = normalizeStoredParts([
    {
      type: "tool-call",
      toolCallId: "ask-1",
      toolName: "askUser",
      args: { prompt: "Which service should I use?" },
    },
  ]);

  assert.deepEqual(parts, [
    {
      type: "dynamic-tool",
      toolCallId: "ask-1",
      toolName: "askUser",
      input: { prompt: "Which service should I use?" },
      state: "input-available",
    },
  ]);
});

test("normalizeStoredParts preserves completed askUser tool output", () => {
  const parts = normalizeStoredParts([
    {
      type: "tool-call",
      toolCallId: "ask-1",
      toolName: "askUser",
      args: { prompt: "Which service should I use?" },
    },
    {
      type: "tool-result",
      toolCallId: "ask-1",
      toolName: "askUser",
      result: { status: "answered", answer: "Use example.com" },
    },
  ]);

  assert.deepEqual(parts, [
    {
      type: "dynamic-tool",
      toolCallId: "ask-1",
      toolName: "askUser",
      input: { prompt: "Which service should I use?" },
      state: "output-available",
      output: { status: "answered", answer: "Use example.com" },
    },
  ]);
});

test("normalizeStoredParts preserves providerExecuted on completed tool output", () => {
  const parts = normalizeStoredParts([
    {
      type: "tool-call",
      toolCallId: "media-1",
      toolName: "generateMedia",
      args: { mode: "image", prompt: "Logo" },
      providerExecuted: true,
    },
    {
      type: "tool-result",
      toolCallId: "media-1",
      toolName: "generateMedia",
      result: { ok: true, images: ["https://example.com/logo.png"] },
      providerExecuted: true,
    },
  ]);

  assert.deepEqual(parts, [
    {
      type: "dynamic-tool",
      toolCallId: "media-1",
      toolName: "generateMedia",
      input: { mode: "image", prompt: "Logo" },
      state: "output-available",
      output: { ok: true, images: ["https://example.com/logo.png"] },
      providerExecuted: true,
    },
  ]);
});

test("normalizeStoredParts preserves pending requestBrowserConnection tool calls", () => {
  const parts = normalizeStoredParts([
    {
      type: "tool-call",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      args: {
        task: "Sign up for example.com",
        preferredMethod: "cdp-direct",
      },
    },
  ]);

  assert.deepEqual(parts, [
    {
      type: "dynamic-tool",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      input: {
        task: "Sign up for example.com",
        preferredMethod: "cdp-direct",
      },
      state: "input-available",
    },
  ]);
});

test("normalizeStoredParts preserves completed requestBrowserConnection output", () => {
  const parts = normalizeStoredParts([
    {
      type: "tool-call",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      args: {
        task: "Sign up for example.com",
        preferredMethod: "cdp-direct",
      },
    },
    {
      type: "tool-result",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      result: {
        status: "connected",
        method: "cdp-direct",
      },
    },
  ]);

  assert.deepEqual(parts, [
    {
      type: "dynamic-tool",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      input: {
        task: "Sign up for example.com",
        preferredMethod: "cdp-direct",
      },
      state: "output-available",
      output: {
        status: "connected",
        method: "cdp-direct",
      },
    },
  ]);
});

test("repairAssistantMessagesForModelReplay keeps answered askUser parts", () => {
  const messages = repairAssistantMessagesForModelReplay([
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "ask-1",
          toolName: "askUser",
          input: { prompt: "Which service should I use?" },
          state: "output-available",
          output: { status: "answered", answer: "Use example.com" },
        },
      ],
    },
  ]);

  assert.equal(messages.length, 1);
  assert.deepEqual((messages[0] as Record<string, unknown>).parts, [
    {
      type: "dynamic-tool",
      toolCallId: "ask-1",
      toolName: "askUser",
      input: { prompt: "Which service should I use?" },
      state: "output-available",
      output: { status: "answered", answer: "Use example.com" },
    },
  ]);
});

test("repairAssistantMessagesForModelReplay keeps connected browser connection parts", () => {
  const messages = repairAssistantMessagesForModelReplay([
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "browser-1",
          toolName: "requestBrowserConnection",
          input: { task: "Sign up for example.com" },
          state: "output-available",
          output: { status: "connected", method: "extension-relay" },
        },
      ],
    },
  ]);

  assert.equal(messages.length, 1);
  assert.deepEqual((messages[0] as Record<string, unknown>).parts, [
    {
      type: "dynamic-tool",
      toolCallId: "browser-1",
      toolName: "requestBrowserConnection",
      input: { task: "Sign up for example.com" },
      state: "output-available",
      output: { status: "connected", method: "extension-relay" },
    },
  ]);
});
