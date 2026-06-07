import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMarkdownHref } from "./markdown-links.ts";

test("normalizeMarkdownHref accepts web and app links", () => {
  assert.equal(
    normalizeMarkdownHref("https://example.com/path?x=1"),
    "https://example.com/path?x=1"
  );
  assert.equal(normalizeMarkdownHref("example.com/docs"), "https://example.com/docs");
  assert.equal(normalizeMarkdownHref("/settings"), "/settings");
});

test("normalizeMarkdownHref rejects unsafe or malformed links", () => {
  assert.equal(normalizeMarkdownHref("javascript:alert(1)"), null);
  assert.equal(normalizeMarkdownHref("mailto:hello@example.com"), null);
  assert.equal(normalizeMarkdownHref("//example.com/path"), null);
  assert.equal(normalizeMarkdownHref("https://"), null);
  assert.equal(normalizeMarkdownHref("https://example.com/bad path"), null);
});
