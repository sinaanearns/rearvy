/**
 * Tests for ScreenshotSanitizer.
 * jimp is not required here — we test pure logic functions.
 */
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isSensitiveElement,
  getSensitiveBounds,
  sanitizeScreenshot,
} = require("./screenshot-sanitizer.cjs");

test("isSensitiveElement detects type=password", () => {
  assert.ok(isSensitiveElement({ type: "password" }));
});

test("isSensitiveElement detects password in name", () => {
  assert.ok(isSensitiveElement({ type: "text", name: "user-password" }));
});

test("isSensitiveElement detects cvv in label", () => {
  assert.ok(isSensitiveElement({ label: "CVV number" }));
});

test("isSensitiveElement detects otp", () => {
  assert.ok(isSensitiveElement({ name: "otp_code" }));
});

test("isSensitiveElement allows safe fields", () => {
  assert.ok(!isSensitiveElement({ type: "text", name: "username" }));
  assert.ok(!isSensitiveElement({ type: "email" }));
});

test("getSensitiveBounds returns rects for sensitive elements", () => {
  const elements = [
    { type: "password", bounds: { x: 10, y: 20, width: 200, height: 30 } },
    { type: "text", name: "email", bounds: { x: 10, y: 60, width: 200, height: 30 } },
    { name: "cvv", bounds: { x: 10, y: 100, width: 60, height: 30 } },
  ];
  const rects = getSensitiveBounds(elements);
  assert.equal(rects.length, 2, "should find 2 sensitive fields");
  assert.deepEqual(rects[0], { x: 10, y: 20, width: 200, height: 30 });
  assert.deepEqual(rects[1], { x: 10, y: 100, width: 60, height: 30 });
});

test("getSensitiveBounds skips elements without bounds", () => {
  const elements = [{ type: "password" }]; // no bounds
  const rects = getSensitiveBounds(elements);
  assert.equal(rects.length, 0);
});

test("sanitizeScreenshot returns original when no rects", async () => {
  const original = "data:image/png;base64,AAAA";
  const result = await sanitizeScreenshot(original, []);
  assert.equal(result, original);
});

test("sanitizeScreenshot returns original when dataUrl is falsy", async () => {
  const result = await sanitizeScreenshot(null, [{ x: 0, y: 0, width: 10, height: 10 }]);
  assert.equal(result, null);
});
