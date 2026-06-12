import assert from "node:assert/strict";
import test from "node:test";

import {
  hasScreenshotDataUrl,
  normalizeScreenshotBase64,
  normalizeScreenshotDataUrl,
  normalizeScreenshotInputDataUrl,
} from "./screenshot-data-url";

test("normalizeScreenshotDataUrl accepts safe image data URLs", () => {
  assert.equal(
    normalizeScreenshotDataUrl("data:IMAGE/PNG;base64, abcd== "),
    "data:image/png;base64,abcd=="
  );
  assert.equal(
    normalizeScreenshotDataUrl("data:image/jpeg;base64,abc123"),
    "data:image/jpeg;base64,abc123"
  );
});

test("normalizeScreenshotDataUrl rejects unsafe or non-data screenshot values", () => {
  assert.equal(normalizeScreenshotDataUrl("https://example.com/screen.png"), null);
  assert.equal(normalizeScreenshotDataUrl("blob:https://example.com/screen"), null);
  assert.equal(normalizeScreenshotDataUrl("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(normalizeScreenshotDataUrl("data:text/html;base64,PGgxPg=="), null);
  assert.equal(normalizeScreenshotDataUrl("data:image/png,abcd"), null);
  assert.equal(normalizeScreenshotDataUrl(undefined), null);
});

test("hasScreenshotDataUrl mirrors screenshot normalization", () => {
  assert.equal(hasScreenshotDataUrl("data:image/webp;base64,abcd"), true);
  assert.equal(hasScreenshotDataUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
});

test("normalizeScreenshotBase64 extracts safe data URL and raw payloads", () => {
  assert.equal(
    normalizeScreenshotBase64("data:IMAGE/PNG;base64, abcd== "),
    "abcd=="
  );
  assert.equal(normalizeScreenshotBase64(" rawBase64== "), "rawBase64==");
  assert.equal(normalizeScreenshotBase64("data:image/svg+xml;base64,PHN2Zz4="), "");
  assert.equal(normalizeScreenshotBase64("not base64!!!"), "");
});

test("normalizeScreenshotInputDataUrl wraps raw base64 as PNG", () => {
  assert.equal(
    normalizeScreenshotInputDataUrl(" rawBase64== "),
    "data:image/png;base64,rawBase64=="
  );
  assert.equal(
    normalizeScreenshotInputDataUrl("data:image/webp;base64, abcd "),
    "data:image/webp;base64,abcd"
  );
  assert.equal(normalizeScreenshotInputDataUrl("data:text/html;base64,PGgxPg=="), null);
});
