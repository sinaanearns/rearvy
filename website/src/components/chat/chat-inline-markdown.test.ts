import test from "node:test";
import assert from "node:assert/strict";

import { parseInlineMarkdownTokens } from "./chat-inline-markdown.ts";

test("parseInlineMarkdownTokens parses strong, emphasis, and code tokens", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Use **bold `code`** and *em*."), [
    { type: "text", text: "Use " },
    {
      type: "strong",
      children: [
        { type: "text", text: "bold " },
        { type: "code", text: "code" },
      ],
    },
    { type: "text", text: " and " },
    {
      type: "emphasis",
      children: [{ type: "text", text: "em" }],
    },
    { type: "text", text: "." },
  ]);
});

test("parseInlineMarkdownTokens parses underscore strong and emphasis tokens", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Use __bold `code`__ and _em_."), [
    { type: "text", text: "Use " },
    {
      type: "strong",
      children: [
        { type: "text", text: "bold " },
        { type: "code", text: "code" },
      ],
    },
    { type: "text", text: " and " },
    {
      type: "emphasis",
      children: [{ type: "text", text: "em" }],
    },
    { type: "text", text: "." },
  ]);
});

test("parseInlineMarkdownTokens keeps escaped and word-internal underscores literal", () => {
  assert.deepEqual(
    parseInlineMarkdownTokens("Keep \\_literal\\_ and snake_case_value."),
    [
      {
        type: "text",
        text: "Keep _literal_ and snake_case_value.",
      },
    ]
  );
});

test("parseInlineMarkdownTokens parses strikethrough with nested inline tokens", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Use ~~old **bold**~~ now."), [
    { type: "text", text: "Use " },
    {
      type: "strikethrough",
      children: [
        { type: "text", text: "old " },
        {
          type: "strong",
          children: [{ type: "text", text: "bold" }],
        },
      ],
    },
    { type: "text", text: " now." },
  ]);
});

test("parseInlineMarkdownTokens keeps escaped strikethrough delimiters literal", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Keep \\~~literal\\~~ text."), [
    { type: "text", text: "Keep ~~literal~~ text." },
  ]);
});

test("parseInlineMarkdownTokens normalizes explicit markdown links", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Open [docs](example.com/docs)."), [
    { type: "text", text: "Open " },
    {
      type: "link",
      href: "https://example.com/docs",
      children: [{ type: "text", text: "docs" }],
    },
    { type: "text", text: "." },
  ]);
});

test("parseInlineMarkdownTokens parses inline formatting inside link labels", () => {
  assert.deepEqual(
    parseInlineMarkdownTokens("Open [**API** `docs`](example.com/docs)."),
    [
      { type: "text", text: "Open " },
      {
        type: "link",
        href: "https://example.com/docs",
        children: [
          {
            type: "strong",
            children: [{ type: "text", text: "API" }],
          },
          { type: "text", text: " " },
          { type: "code", text: "docs" },
        ],
      },
      { type: "text", text: "." },
    ]
  );
});

test("parseInlineMarkdownTokens keeps escaped inline delimiters as literal text", () => {
  assert.deepEqual(
    parseInlineMarkdownTokens(
      "Use \\*literal\\*, \\`code\\`, \\[docs](example.com), and \\<https://example.com>."
    ),
    [
      {
        type: "text",
        text: "Use *literal*, `code`, [docs](example.com), and <https://example.com>.",
      },
    ]
  );
});

test("parseInlineMarkdownTokens supports balanced parentheses in explicit links", () => {
  assert.deepEqual(
    parseInlineMarkdownTokens("Read [wiki](https://example.com/wiki/Foo_(bar))."),
    [
      { type: "text", text: "Read " },
      {
        type: "link",
        href: "https://example.com/wiki/Foo_(bar)",
        children: [{ type: "text", text: "wiki" }],
      },
      { type: "text", text: "." },
    ]
  );
});

test("parseInlineMarkdownTokens keeps unsafe markdown links as text", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Bad [link](javascript:alert(1)) here"), [
    { type: "text", text: "Bad [link](javascript:alert(1)) here" },
  ]);
});

test("parseInlineMarkdownTokens keeps bare URL sentence punctuation outside links", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Visit https://example.com/path."), [
    { type: "text", text: "Visit " },
    {
      type: "link",
      href: "https://example.com/path",
      children: [{ type: "text", text: "https://example.com/path" }],
    },
    { type: "text", text: "." },
  ]);
});

test("parseInlineMarkdownTokens parses angle-bracket autolinks", () => {
  assert.deepEqual(parseInlineMarkdownTokens("Visit <https://example.com/path>."), [
    { type: "text", text: "Visit " },
    {
      type: "link",
      href: "https://example.com/path",
      children: [{ type: "text", text: "https://example.com/path" }],
    },
    { type: "text", text: "." },
  ]);
});

test("parseInlineMarkdownTokens supports balanced parentheses in bare URLs", () => {
  assert.deepEqual(
    parseInlineMarkdownTokens("Read https://example.com/wiki/Foo_(bar)."),
    [
      { type: "text", text: "Read " },
      {
        type: "link",
        href: "https://example.com/wiki/Foo_(bar)",
        children: [{ type: "text", text: "https://example.com/wiki/Foo_(bar)" }],
      },
      { type: "text", text: "." },
    ]
  );
});

test("parseInlineMarkdownTokens keeps wrapper parentheses outside bare links", () => {
  assert.deepEqual(parseInlineMarkdownTokens("(https://example.com/path)"), [
    { type: "text", text: "(" },
    {
      type: "link",
      href: "https://example.com/path",
      children: [{ type: "text", text: "https://example.com/path" }],
    },
    { type: "text", text: ")" },
  ]);
});
