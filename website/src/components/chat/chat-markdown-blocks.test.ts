import test from "node:test";
import assert from "node:assert/strict";

import {
  parseMarkdownBlocks,
  preProcessMarkdownContent,
} from "./chat-markdown-blocks.ts";

test("parseMarkdownBlocks routes generated card fences to special block types", () => {
  const blocks = parseMarkdownBlocks(
    [
      "```CLAUDE-CARDS",
      "{\"cards\":[]}",
      "```",
      "```interactive-explainer",
      "{\"principal\":5000}",
      "```",
      "```trade-chart",
      "{\"symbol\":\"BTC-USD\"}",
      "```",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    { type: "claude-cards", configText: "{\"cards\":[]}" },
    { type: "interactive-explainer", configText: "{\"principal\":5000}" },
    { type: "trade-chart", configText: "{\"symbol\":\"BTC-USD\"}" },
  ]);
});

test("parseMarkdownBlocks ignores extra fence info when routing card blocks", () => {
  const blocks = parseMarkdownBlocks(
    [
      "```claude-cards json",
      "{\"cards\":[]}",
      "```",
      "```trade-chart generated",
      "{\"symbol\":\"BTC-USD\"}",
      "```",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    { type: "claude-cards", configText: "{\"cards\":[]}" },
    { type: "trade-chart", configText: "{\"symbol\":\"BTC-USD\"}" },
  ]);
});

test("parseMarkdownBlocks keeps ordinary fenced code as code", () => {
  const blocks = parseMarkdownBlocks("```ts title=\"example\"\nconst value = 1;\n```");

  assert.deepEqual(blocks, [
    {
      type: "code",
      language: "ts",
      content: "const value = 1;",
    },
  ]);
});

test("preProcessMarkdownContent unwraps serialized text-part arrays before decoding escapes", () => {
  const content = preProcessMarkdownContent(
    JSON.stringify([
      { type: "text", text: "Headline\\n\\n- First\\n- Second" },
      { type: "text", text: "\\nDone" },
    ])
  );

  assert.equal(content, "Headline\n\n- First\n- Second\nDone");
});

test("preProcessMarkdownContent leaves malformed serialized content usable", () => {
  const content = preProcessMarkdownContent(
    "[{\"type\":\"text\",\"text\":\"Still\\nreadable\""
  );

  assert.equal(content, "[{\"type\":\"text\",\"text\":\"Still\nreadable\"");
});

test("preProcessMarkdownContent preserves escaped newlines inside fenced JSON", () => {
  const configText = JSON.stringify({
    cards: [{ label: "Summary", note: "Line one\nLine two" }],
  });
  const content = preProcessMarkdownContent(
    [
      "Intro\\nparagraph",
      "```claude-cards",
      configText,
      "```",
      "Outro\\ttext",
    ].join("\n")
  );

  assert.equal(
    content,
    ["Intro\nparagraph", "```claude-cards", configText, "```", "Outro\ttext"].join(
      "\n"
    )
  );

  const blocks = parseMarkdownBlocks(content);
  assert.deepEqual(blocks, [
    { type: "paragraph", content: "Intro paragraph" },
    { type: "claude-cards", configText },
    { type: "paragraph", content: "Outro\ttext" },
  ]);
});

test("preProcessMarkdownContent preserves fenced JSON in fully escaped messages", () => {
  const configText = JSON.stringify({
    cards: [{ label: "Summary", note: "Line one\nLine two" }],
  });
  const content = preProcessMarkdownContent(
    ["Intro", "```claude-cards", configText, "```", "Outro"].join("\\n")
  );

  assert.equal(
    content,
    ["Intro", "```claude-cards", configText, "```", "Outro"].join("\n")
  );

  assert.deepEqual(parseMarkdownBlocks(content), [
    { type: "paragraph", content: "Intro" },
    { type: "claude-cards", configText },
    { type: "paragraph", content: "Outro" },
  ]);
});

test("preProcessMarkdownContent collapses prose gaps without touching fenced code gaps", () => {
  const content = preProcessMarkdownContent(
    [
      "Intro",
      "",
      "",
      "```ts",
      "const a = 1;",
      "",
      "",
      "const b = 2;",
      "```",
      "",
      "",
      "Outro",
    ].join("\n")
  );

  assert.equal(
    content,
    [
      "Intro",
      "",
      "```ts",
      "const a = 1;",
      "",
      "",
      "const b = 2;",
      "```",
      "",
      "Outro",
    ].join("\n")
  );
});

test("parseMarkdownBlocks parses markdown tables and direct prompt blocks", () => {
  const blocks = parseMarkdownBlocks(
    [
      "| Metric | Value |",
      "| --- | ---: |",
      "| Revenue | $10K |",
      "",
      "Direct prompt for your AI chat implementation:",
      "```",
      "Use this prompt.",
      "```",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "table",
      headers: ["Metric", "Value"],
      alignments: ["left", "right"],
      rows: [["Revenue", "$10K"]],
    },
    {
      type: "paragraph",
      content: "Direct prompt for your AI chat implementation:",
    },
    {
      type: "prompt",
      content: "Use this prompt.",
    },
  ]);
});

test("parseMarkdownBlocks supports standard divider marker styles", () => {
  const blocks = parseMarkdownBlocks(
    [
      "Intro",
      "",
      "---",
      "",
      "***",
      "",
      "_ _ _",
      "",
      "Outro",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    { type: "paragraph", content: "Intro" },
    { type: "divider" },
    { type: "divider" },
    { type: "divider" },
    { type: "paragraph", content: "Outro" },
  ]);
});

test("parseMarkdownBlocks starts tables immediately after prose lines", () => {
  const blocks = parseMarkdownBlocks(
    [
      "Here are the numbers:",
      "| Metric | Value |",
      "| --- | ---: |",
      "| Revenue | $10K |",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "paragraph",
      content: "Here are the numbers:",
    },
    {
      type: "table",
      headers: ["Metric", "Value"],
      alignments: ["left", "right"],
      rows: [["Revenue", "$10K"]],
    },
  ]);
});

test("parseMarkdownBlocks keeps escaped table pipes inside cells", () => {
  const blocks = parseMarkdownBlocks(
    [
      "| Variant \\| Segment | Notes |",
      "| --- | --- |",
      "| A \\| B | Keep both values |",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "table",
      headers: ["Variant | Segment", "Notes"],
      alignments: ["left", "left"],
      rows: [["A | B", "Keep both values"]],
    },
  ]);
});

test("parseMarkdownBlocks preserves table column alignments", () => {
  const blocks = parseMarkdownBlocks(
    [
      "| Left | Center | Right |",
      "| :--- | :---: | ---: |",
      "| A | B | C |",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "table",
      headers: ["Left", "Center", "Right"],
      alignments: ["left", "center", "right"],
      rows: [["A", "B", "C"]],
    },
  ]);
});

test("parseMarkdownBlocks preserves ordered list start numbers", () => {
  const blocks = parseMarkdownBlocks(
    [
      "3. Review the generated draft",
      "4. Send it after approval",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "ordered-list",
      start: 3,
      items: ["Review the generated draft", "Send it after approval"],
    },
  ]);
});

test("parseMarkdownBlocks supports plus-prefixed unordered lists", () => {
  const blocks = parseMarkdownBlocks(
    [
      "+ Confirm account",
      "+ Draft the reply",
      "",
      "Then wait for approval.",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "unordered-list",
      items: ["Confirm account", "Draft the reply"],
    },
    {
      type: "paragraph",
      content: "Then wait for approval.",
    },
  ]);
});

test("parseMarkdownBlocks keeps indented unordered list continuations with their item", () => {
  const blocks = parseMarkdownBlocks(
    [
      "- Draft the email",
      "  include the account name and approval note",
      "- Send after review",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "unordered-list",
      items: [
        "Draft the email include the account name and approval note",
        "Send after review",
      ],
    },
  ]);
});

test("parseMarkdownBlocks keeps indented ordered list continuations with their item", () => {
  const blocks = parseMarkdownBlocks(
    [
      "3. Draft the email",
      "   include the account name and approval note",
      "4. Send after review",
    ].join("\n")
  );

  assert.deepEqual(blocks, [
    {
      type: "ordered-list",
      start: 3,
      items: [
        "Draft the email include the account name and approval note",
        "Send after review",
      ],
    },
  ]);
});
