import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssistantTimelineEntries,
  buildTimelinePreview,
  formatExpandedValue,
  getAssistantTimelineErrors,
} from "./assistant-timeline";

test("buildAssistantTimelineEntries marks input-only tool calls as running", () => {
  const entries = buildAssistantTimelineEntries([
    {
      type: "tool-searchWeb",
      toolCallId: "call_1",
      state: "input-available",
      input: { query: "top ecommerce product trends" },
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, "running");
  assert.equal(entries[0].label, "WebSearch");
  assert.equal(entries[0].summary, "top ecommerce product trends");
});

test("buildAssistantTimelineEntries marks output tool parts as completed", () => {
  const entries = buildAssistantTimelineEntries([
    {
      type: "dynamic-tool",
      toolCallId: "call_2",
      toolName: "searchWeb",
      state: "output-available",
      input: { query: "ergonomic office chair" },
      output: {
        results: [
          { title: "Chair A", url: "https://example.com/a", price: "$99" },
          { title: "Chair B", url: "https://example.com/b", price: "$129" },
        ],
      },
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, "completed");
  assert.equal(entries[0].label, "WebSearch");
  assert.equal(entries[0].summary, "Found 2 results");
  assert.equal(entries[0].preview?.kind, "table");
});

test("buildAssistantTimelineEntries maps generated image outputs", () => {
  const entries = buildAssistantTimelineEntries([
    {
      type: "dynamic-tool",
      toolCallId: "call_3",
      toolName: "generateMedia",
      state: "output-available",
      input: { mode: "image", prompt: "smart ergonomic chair concept" },
      output: {
        ok: true,
        mode: "image",
        images: ["https://cdn.example.com/chair.png"],
      },
    },
  ]);

  assert.equal(entries[0].label, "ImageGenerate");
  assert.equal(entries[0].summary, "Generated 1 image");
  assert.equal(entries[0].preview?.kind, "media");
});

test("buildAssistantTimelineEntries marks errored tool parts as failed", () => {
  const entries = buildAssistantTimelineEntries([
    {
      type: "tool-runBrowserTask",
      toolCallId: "call_4",
      state: "output-error",
      input: { task: "open product page" },
      errorText: "Browser session unavailable",
    },
  ]);

  assert.equal(entries[0].status, "failed");
  assert.equal(entries[0].label, "BrowserTask");
});

test("buildTimelinePreview summarizes arrays as a table preview", () => {
  const preview = buildTimelinePreview([
    { product: "Chair A", price: "$99", token: "hidden" },
    { product: "Chair B", price: "$129", token: "hidden" },
  ]);

  assert.equal(preview?.kind, "table");
  if (preview?.kind !== "table") {
    throw new Error("Expected table preview");
  }

  assert.deepEqual(preview.columns, ["product", "price"]);
  assert.equal(preview.rows.length, 2);
});

test("formatExpandedValue redacts sensitive keys", () => {
  const expanded = formatExpandedValue({
    apiKey: "abc123",
    nested: {
      authorization: "Bearer secret",
      url: "https://example.com/path?token=abc123&safe=1",
    },
  });

  assert.ok(expanded?.includes("[REDACTED]"));
  assert.equal(expanded?.includes("abc123"), false);
  assert.equal(expanded?.includes("Bearer secret"), false);
});

test("getAssistantTimelineErrors extracts metadata tool errors", () => {
  const errors = getAssistantTimelineErrors({
    toolErrors: [
      {
        toolName: "searchWeb",
        errorCode: "TOOL_ERROR",
        message: "Search failed.",
      },
    ],
  });

  assert.deepEqual(errors, [
    {
      toolName: "searchWeb",
      errorCode: "TOOL_ERROR",
      message: "Search failed.",
    },
  ]);
});
