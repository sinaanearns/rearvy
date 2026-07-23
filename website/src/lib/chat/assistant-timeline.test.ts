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

test("buildAssistantTimelineEntries uses compact labels for Whispernet and YouTube tools", () => {
  const entries = buildAssistantTimelineEntries([
    {
      type: "tool-runWhispernetAnalysis",
      toolCallId: "call_whispernet",
      state: "output-available",
      input: { forceScan: true },
      output: {
        success: true,
        lastRunAt: "2026-05-28T23:55:49.818Z",
        message: "Whispernet analysis completed successfully.",
      },
    },
    {
      type: "tool-getYouTubeChannelStats",
      toolCallId: "call_youtube",
      state: "output-available",
      output: {
        channelTitle: "Rearvy",
        subscriberCount: 45,
        totalVideoCount: 3,
      },
    },
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.label),
    ["Whispernet", "YouTubeStats"]
  );
  assert.equal(entries[0].summary, "Whispernet analysis completed successfully.");
  assert.equal(
    entries[1].summary,
    "channelTitle: Rearvy | subscriberCount: 45 | totalVideoCount: 3"
  );
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
  assert.equal(entries[0].label, "SessionsSpawn");
});

test("buildAssistantTimelineEntries uses Accio-style browser and workflow labels", () => {
  const entries = buildAssistantTimelineEntries([
    {
      type: "tool-fetchWebPage",
      toolCallId: "web_1",
      state: "output-available",
      input: { url: "https://example.com" },
      output: { url: "https://example.com", title: "Example" },
    },
    {
      type: "tool-askUser",
      toolCallId: "ask_1",
      state: "input-available",
      input: { prompt: "Which account should I use?" },
    },
    {
      type: "tool-controlBrowserSession",
      toolCallId: "browser_1",
      state: "output-available",
      input: { command: "continue" },
      output: { ok: true, message: "Command sent" },
    },
    {
      type: "tool-planWorkflow",
      toolCallId: "workflow_1",
      state: "output-available",
      input: { description: "Capture a screenshot" },
      output: { status: "pending_approval", workflowId: "wf_1" },
    },
    {
      type: "tool-executeWorkflow",
      toolCallId: "workflow_2",
      state: "output-available",
      input: { templateId: "open_url" },
      output: { status: "completed" },
    },
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.label),
    ["WebFetch", "AskUser", "SessionsCommand", "TaskCreate", "TaskUpdate"]
  );
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

test("buildTimelinePreview ignores malformed link values", () => {
  const preview = buildTimelinePreview({
    sources: [
      { title: "Broken", url: "https://" },
      { title: "Valid", url: "https://example.com/path?token=secret&safe=1" },
    ],
  });

  assert.equal(preview?.kind, "links");
  if (preview?.kind !== "links") {
    throw new Error("Expected links preview");
  }

  assert.deepEqual(preview.links, [
    {
      label: "Valid",
      url: "https://example.com/path?token=%5BREDACTED%5D&safe=1",
    },
  ]);
});

test("buildTimelinePreview filters unsafe generated image preview URLs", () => {
  const preview = buildTimelinePreview({
    images: [
      "javascript:alert(1)",
      "data:text/html;base64,PGgxPg==",
      "data:image/png;base64, abcd== ",
      "https://example.com/generated.webp",
    ],
  });

  assert.equal(preview?.kind, "media");
  if (preview?.kind !== "media") {
    throw new Error("Expected media preview");
  }

  assert.equal(preview.mediaType, "image");
  assert.deepEqual(preview.urls, [
    "data:image/png;base64,abcd==",
    "https://example.com/generated.webp",
  ]);
});

test("buildTimelinePreview falls back when generated media URLs are unsafe", () => {
  const preview = buildTimelinePreview({
    images: ["javascript:alert(1)", "data:text/html;base64,PGgxPg=="],
    sources: [{ title: "Safe source", url: "https://example.com/source" }],
  });

  assert.equal(preview?.kind, "links");
  if (preview?.kind !== "links") {
    throw new Error("Expected links preview");
  }

  assert.deepEqual(preview.links, [
    { label: "Safe source", url: "https://example.com/source" },
  ]);
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
