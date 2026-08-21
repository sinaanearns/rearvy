import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeEmailHtml } from "./sanitizer";

test("sanitizeEmailHtml strips script blocks", () => {
  const dirty = "<div>Hello <script>alert('hack')</script>World</div>";
  assert.equal(sanitizeEmailHtml(dirty), "<div>Hello World</div>");
});

test("sanitizeEmailHtml strips on event handlers", () => {
  const dirty = "<img src='x' onload='exploit()' onerror=run() />";
  const result = sanitizeEmailHtml(dirty).trim();
  // Event-handler attributes must be removed
  assert.ok(!result.includes("onload"), "onload should be stripped");
  assert.ok(!result.includes("onerror"), "onerror should be stripped");
  // Safe attributes should be preserved
  assert.ok(result.includes("src='x'"), "src attribute should remain");
});

test("sanitizeEmailHtml preserves standard safe markup", () => {
  const safe = "<p>Please review our <strong>Shopify report</strong>.</p>";
  assert.equal(sanitizeEmailHtml(safe), safe);
});
