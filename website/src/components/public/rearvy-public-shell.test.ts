import assert from "node:assert/strict";
import test from "node:test";

import { isInternalHref } from "./rearvy-public-shell";

test("isInternalHref identifies app routes for Next Link navigation", () => {
  assert.equal(isInternalHref("/signup"), true);
  assert.equal(isInternalHref("/login?redirect=/data-delete"), true);
});

test("isInternalHref rejects external, protocol, and protocol-relative URLs", () => {
  assert.equal(isInternalHref("https://www.rearvy.com/download"), false);
  assert.equal(isInternalHref("mailto:myrearvy@gmail.com"), false);
  assert.equal(isInternalHref("//cdn.example.com/file.exe"), false);
});
