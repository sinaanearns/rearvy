import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWebSourceUrl } from "./web-source-links.ts";

test("normalizeWebSourceUrl accepts http and https urls", () => {
  assert.equal(
    normalizeWebSourceUrl("https://example.com/path?x=1"),
    "https://example.com/path?x=1"
  );
  assert.equal(
    normalizeWebSourceUrl("http://example.com/source"),
    "http://example.com/source"
  );
});

test("normalizeWebSourceUrl rejects unsafe or malformed urls", () => {
  assert.equal(normalizeWebSourceUrl("javascript:alert(1)"), null);
  assert.equal(normalizeWebSourceUrl("mailto:hello@example.com"), null);
  assert.equal(normalizeWebSourceUrl("/internal"), null);
  assert.equal(normalizeWebSourceUrl("example.com"), null);
  assert.equal(normalizeWebSourceUrl("https://"), null);
});
