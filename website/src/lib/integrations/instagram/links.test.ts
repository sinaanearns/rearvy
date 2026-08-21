import assert from "node:assert/strict";
import test from "node:test";

import { normalizeInstagramPermalink } from "./links";

test("normalizeInstagramPermalink accepts HTTPS Instagram links", () => {
  assert.equal(
    normalizeInstagramPermalink(" https://www.instagram.com/p/abc123/?utm_source=test "),
    "https://www.instagram.com/p/abc123/?utm_source=test"
  );
  assert.equal(
    normalizeInstagramPermalink("https://instagram.com/reel/abc123/"),
    "https://instagram.com/reel/abc123/"
  );
});

test("normalizeInstagramPermalink rejects non-Instagram and unsafe links", () => {
  assert.equal(normalizeInstagramPermalink("javascript:alert(1)"), null);
  assert.equal(normalizeInstagramPermalink("http://www.instagram.com/p/abc123/"), null);
  assert.equal(normalizeInstagramPermalink("https://evil.example/p/abc123/"), null);
  assert.equal(normalizeInstagramPermalink("//www.instagram.com/p/abc123/"), null);
  assert.equal(normalizeInstagramPermalink("/p/abc123/"), null);
  assert.equal(normalizeInstagramPermalink(null), null);
});
