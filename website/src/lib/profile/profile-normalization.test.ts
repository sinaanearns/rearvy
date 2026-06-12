import assert from "node:assert/strict";
import test from "node:test";

import {
  isSafeProfileAvatarMimeType,
  normalizeProfileAvatarUrl,
  normalizeProfileProjectLinks,
} from "./profile-normalization.ts";

test("normalizeProfileProjectLinks accepts arrays and newline-separated http links", () => {
  assert.deepEqual(
    normalizeProfileProjectLinks([
      " https://example.com ",
      "https://example.com",
      "http://localhost:3000/profile",
      "https://rearvy.com/a\nhttps://rearvy.com/b",
    ]),
    [
      "https://example.com/",
      "http://localhost:3000/profile",
      "https://rearvy.com/a",
      "https://rearvy.com/b",
    ]
  );
});

test("normalizeProfileProjectLinks accepts pasted newline-separated link text", () => {
  assert.deepEqual(
    normalizeProfileProjectLinks(
      "https://one.test\njavascript:alert(1)\nhttps://two.test/path"
    ),
    ["https://one.test/", "https://two.test/path"]
  );
});

test("normalizeProfileProjectLinks rejects malformed and unsafe links", () => {
  assert.deepEqual(
    normalizeProfileProjectLinks([
      "javascript:alert(1)",
      "mailto:hello@example.com",
      "//example.com/path",
      "/internal",
      "example.com",
      "https://",
      null,
    ]),
    []
  );
});

test("normalizeProfileProjectLinks enforces the configured limit", () => {
  assert.deepEqual(
    normalizeProfileProjectLinks(
      ["https://one.test", "https://two.test", "https://three.test"],
      2
    ),
    ["https://one.test/", "https://two.test/"]
  );
});

test("normalizeProfileAvatarUrl accepts http image URLs and safe raster data URLs", () => {
  assert.equal(
    normalizeProfileAvatarUrl(" https://example.com/avatar.png "),
    "https://example.com/avatar.png"
  );
  assert.equal(
    normalizeProfileAvatarUrl("data:IMAGE/PNG;base64, abcd== "),
    "data:image/png;base64,abcd=="
  );
});

test("normalizeProfileAvatarUrl rejects unsafe avatar values", () => {
  assert.equal(normalizeProfileAvatarUrl("javascript:alert(1)"), null);
  assert.equal(normalizeProfileAvatarUrl("/avatar.png"), null);
  assert.equal(
    normalizeProfileAvatarUrl("data:image/svg+xml;base64,PHN2Zz4="),
    null
  );
  assert.equal(normalizeProfileAvatarUrl("data:text/html;base64,PGgxPg=="), null);
  assert.equal(normalizeProfileAvatarUrl("data:image/png,abcd"), null);
  assert.equal(normalizeProfileAvatarUrl(null), null);
});

test("isSafeProfileAvatarMimeType accepts only supported raster image types", () => {
  assert.equal(isSafeProfileAvatarMimeType("image/png"), true);
  assert.equal(isSafeProfileAvatarMimeType(" IMAGE/WEBP "), true);
  assert.equal(isSafeProfileAvatarMimeType("image/svg+xml"), false);
  assert.equal(isSafeProfileAvatarMimeType("text/html"), false);
  assert.equal(isSafeProfileAvatarMimeType(undefined), false);
});
