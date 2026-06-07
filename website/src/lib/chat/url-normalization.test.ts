import assert from "node:assert/strict";
import test from "node:test";

import { normalizeHttpUrl } from "./url-normalization.ts";

test("normalizeHttpUrl accepts only parseable http and https urls", () => {
  assert.equal(normalizeHttpUrl(" https://example.com/a "), "https://example.com/a");
  assert.equal(normalizeHttpUrl("http://example.com/a"), "http://example.com/a");
  assert.equal(normalizeHttpUrl("ftp://example.com/a"), null);
  assert.equal(normalizeHttpUrl("example.com/a"), null);
  assert.equal(normalizeHttpUrl("https://"), null);
});
