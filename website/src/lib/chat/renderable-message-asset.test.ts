import assert from "node:assert/strict";
import test from "node:test";

import {
  getRenderableMessageFileKind,
  normalizeRenderableMessageAssetSrc,
} from "./renderable-message-asset.ts";

test("normalizeRenderableMessageAssetSrc accepts safe image sources", () => {
  assert.equal(
    normalizeRenderableMessageAssetSrc(" https://example.com/photo.png ", "image"),
    "https://example.com/photo.png"
  );
  assert.equal(
    normalizeRenderableMessageAssetSrc(
      "data:IMAGE/WEBP;base64, abcd== ",
      "image"
    ),
    "data:image/webp;base64,abcd=="
  );
  assert.equal(
    normalizeRenderableMessageAssetSrc(new URL("https://example.com/a.jpg"), "image"),
    "https://example.com/a.jpg"
  );
});

test("normalizeRenderableMessageAssetSrc rejects unsafe image sources", () => {
  assert.equal(
    normalizeRenderableMessageAssetSrc("javascript:alert(1)", "image"),
    null
  );
  assert.equal(normalizeRenderableMessageAssetSrc("/photo.png", "image"), null);
  assert.equal(
    normalizeRenderableMessageAssetSrc("data:image/svg+xml;base64,PHN2Zz4=", "image"),
    null
  );
  assert.equal(
    normalizeRenderableMessageAssetSrc("data:text/html;base64,PGgxPg==", "image"),
    null
  );
});

test("normalizeRenderableMessageAssetSrc accepts safe video sources only for video rendering", () => {
  assert.equal(
    normalizeRenderableMessageAssetSrc("data:video/mp4;base64,abcd", "video"),
    "data:video/mp4;base64,abcd"
  );
  assert.equal(
    normalizeRenderableMessageAssetSrc("data:image/png;base64,abcd", "video"),
    null
  );
});

test("getRenderableMessageFileKind accepts safe media MIME types only", () => {
  assert.equal(getRenderableMessageFileKind("image/png"), "image");
  assert.equal(getRenderableMessageFileKind(" IMAGE/AVIF "), "image");
  assert.equal(getRenderableMessageFileKind("video/webm"), "video");
  assert.equal(getRenderableMessageFileKind("image/svg+xml"), null);
  assert.equal(getRenderableMessageFileKind("text/html"), null);
  assert.equal(getRenderableMessageFileKind(undefined), null);
});
