import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReferenceFrames } from "./content-recreation-workflow.ts";

test("normalizes raw base64 reference frames into image data URLs", () => {
  assert.deepEqual(normalizeReferenceFrames([" YWJjZA== "]), [
    "data:image/png;base64,YWJjZA==",
  ]);
});

test("retains only safe image references and caps the frame count", () => {
  const safeFrame = "data:image/webp;base64,YWJjZA==";
  const frames = normalizeReferenceFrames([
    "javascript:alert(1)",
    "data:text/html;base64,PGgxPkJhZDwvaDE+",
    safeFrame,
    safeFrame,
    safeFrame,
    safeFrame,
    safeFrame,
    safeFrame,
    safeFrame,
    safeFrame,
  ]);

  assert.equal(frames.length, 8);
  assert.ok(frames.every((frame) => frame === safeFrame));
});
