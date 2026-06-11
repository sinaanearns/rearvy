import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeGeneratedMediaUrl,
  normalizeGeneratedMediaUrls,
} from "./generated-media-url";

test("normalizeGeneratedMediaUrl accepts http and https media URLs", () => {
  assert.equal(
    normalizeGeneratedMediaUrl(" https://example.com/generated.png ", "image"),
    "https://example.com/generated.png"
  );
  assert.equal(
    normalizeGeneratedMediaUrl("http://example.com/generated.mp4", "video"),
    "http://example.com/generated.mp4"
  );
});

test("normalizeGeneratedMediaUrl accepts safe generated data media URLs", () => {
  assert.equal(
    normalizeGeneratedMediaUrl("data:IMAGE/PNG;base64, abcd== ", "image"),
    "data:image/png;base64,abcd=="
  );
  assert.equal(
    normalizeGeneratedMediaUrl("data:video/mp4;base64,abc123", "video"),
    "data:video/mp4;base64,abc123"
  );
});

test("normalizeGeneratedMediaUrl rejects unsafe or mismatched media URLs", () => {
  assert.equal(normalizeGeneratedMediaUrl("javascript:alert(1)", "image"), null);
  assert.equal(normalizeGeneratedMediaUrl("/generated.png", "image"), null);
  assert.equal(normalizeGeneratedMediaUrl("data:text/html;base64,PGgxPg==", "image"), null);
  assert.equal(normalizeGeneratedMediaUrl("data:image/svg+xml;base64,PHN2Zz4=", "image"), null);
  assert.equal(normalizeGeneratedMediaUrl("data:image/png,abcd", "image"), null);
  assert.equal(normalizeGeneratedMediaUrl("data:image/png;base64,abcd", "video"), null);
  assert.equal(normalizeGeneratedMediaUrl(null, "image"), null);
});

test("normalizeGeneratedMediaUrls filters unsafe generated media URLs", () => {
  assert.deepEqual(
    normalizeGeneratedMediaUrls(
      [
        "https://example.com/a.png",
        "javascript:alert(1)",
        42,
        "data:image/webp;base64,abcd",
      ],
      "image"
    ),
    ["https://example.com/a.png", "data:image/webp;base64,abcd"]
  );
});
