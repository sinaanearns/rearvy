import assert from "node:assert/strict";
import test from "node:test";

import {
  extractFirstOpenableBrowserUrl,
  normalizeOpenableBrowserUrl,
} from "./openable-url";

test("normalizeOpenableBrowserUrl accepts only http and https URLs", () => {
  assert.equal(normalizeOpenableBrowserUrl(" https://example.com/path "), "https://example.com/path");
  assert.equal(normalizeOpenableBrowserUrl("http://localhost:3000/page"), "http://localhost:3000/page");
  assert.equal(normalizeOpenableBrowserUrl("javascript:alert(1)"), null);
  assert.equal(normalizeOpenableBrowserUrl("chrome://settings"), null);
  assert.equal(normalizeOpenableBrowserUrl("/internal"), null);
});

test("extractFirstOpenableBrowserUrl finds a safe URL inside browser session text", () => {
  assert.equal(
    extractFirstOpenableBrowserUrl("Task: inspect https://example.com/path?x=1."),
    "https://example.com/path?x=1"
  );
  assert.equal(
    extractFirstOpenableBrowserUrl("No link", "Current URL: http://localhost:3000/work"),
    "http://localhost:3000/work"
  );
});

test("extractFirstOpenableBrowserUrl ignores unsafe URL-like text", () => {
  assert.equal(extractFirstOpenableBrowserUrl("javascript:alert(1)"), null);
  assert.equal(extractFirstOpenableBrowserUrl("chrome://settings"), null);
  assert.equal(extractFirstOpenableBrowserUrl("example.com/no-protocol"), null);
});
