import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMarkdownHref,
  splitBareMarkdownUrlToken,
} from "./markdown-links.ts";

test("normalizeMarkdownHref accepts web and app links", () => {
  assert.equal(
    normalizeMarkdownHref("https://example.com/path?x=1"),
    "https://example.com/path?x=1"
  );
  assert.equal(normalizeMarkdownHref("example.com/docs"), "https://example.com/docs");
  assert.equal(normalizeMarkdownHref("/settings"), "/settings");
  assert.equal(
    normalizeMarkdownHref("/login?redirect=/chat#start"),
    "/login?redirect=/chat#start"
  );
});

test("normalizeMarkdownHref rejects unsafe or malformed links", () => {
  assert.equal(normalizeMarkdownHref("javascript:alert(1)"), null);
  assert.equal(normalizeMarkdownHref("mailto:hello@example.com"), null);
  assert.equal(normalizeMarkdownHref("//example.com/path"), null);
  assert.equal(normalizeMarkdownHref("https://"), null);
  assert.equal(normalizeMarkdownHref("https://example.com/bad path"), null);
  assert.equal(normalizeMarkdownHref("/settings\\evil"), null);
  assert.equal(normalizeMarkdownHref("/%2e%2e/secret"), null);
  assert.equal(normalizeMarkdownHref("/%2Fsecret"), null);
  assert.equal(normalizeMarkdownHref("/%5Csecret"), null);
  assert.equal(normalizeMarkdownHref("/bad%zzpath"), null);
});

test("splitBareMarkdownUrlToken keeps sentence punctuation outside auto links", () => {
  assert.deepEqual(splitBareMarkdownUrlToken("https://example.com/path."), {
    hrefText: "https://example.com/path",
    suffix: ".",
  });
  assert.deepEqual(splitBareMarkdownUrlToken("https://example.com/path?!"), {
    hrefText: "https://example.com/path",
    suffix: "?!",
  });
  assert.deepEqual(splitBareMarkdownUrlToken("https://example.com/path"), {
    hrefText: "https://example.com/path",
    suffix: "",
  });
});

test("splitBareMarkdownUrlToken preserves balanced URL parentheses", () => {
  assert.deepEqual(splitBareMarkdownUrlToken("https://example.com/wiki/Foo_(bar)."), {
    hrefText: "https://example.com/wiki/Foo_(bar)",
    suffix: ".",
  });
  assert.deepEqual(splitBareMarkdownUrlToken("https://example.com/path)"), {
    hrefText: "https://example.com/path",
    suffix: ")",
  });
});
