const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeScreenshotBase64,
  normalizeScreenshotDataUrl,
  normalizeScreenshotInputDataUrl,
} = require("./screenshot-data-url.cjs");

test("normalizeScreenshotDataUrl accepts safe image data URLs", () => {
  assert.equal(
    normalizeScreenshotDataUrl("data:IMAGE/PNG;base64, abcd== "),
    "data:image/png;base64,abcd=="
  );
  assert.equal(
    normalizeScreenshotDataUrl("data:image/webp;base64,abc123"),
    "data:image/webp;base64,abc123"
  );
});

test("normalizeScreenshotDataUrl rejects unsafe screenshot data URLs", () => {
  assert.equal(normalizeScreenshotDataUrl("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(normalizeScreenshotDataUrl("data:text/html;base64,PGgxPg=="), null);
  assert.equal(normalizeScreenshotDataUrl("data:image/png,abcd"), null);
  assert.equal(normalizeScreenshotDataUrl("https://example.com/screen.png"), null);
});

test("normalizeScreenshotBase64 extracts safe payloads only", () => {
  assert.equal(normalizeScreenshotBase64("data:image/png;base64, abcd== "), "abcd==");
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
    normalizeScreenshotInputDataUrl("data:image/jpeg;base64, abcd "),
    "data:image/jpeg;base64,abcd"
  );
  assert.equal(normalizeScreenshotInputDataUrl("javascript:alert(1)"), null);
});
