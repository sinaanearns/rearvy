import assert from "node:assert/strict";
import test from "node:test";

import { APP_NAME } from "@/lib/utils/constants";
import { normalizeRearvyDisplayText } from "./brand-display";

test("normalizeRearvyDisplayText preserves trimmed display strings", () => {
  assert.equal(normalizeRearvyDisplayText("  Sarah Connor  "), "Sarah Connor");
});

test("normalizeRearvyDisplayText returns null for non-display values", () => {
  assert.equal(normalizeRearvyDisplayText("   "), null);
  assert.equal(normalizeRearvyDisplayText(null), null);
  assert.equal(normalizeRearvyDisplayText(42), null);
});

test("normalizeRearvyDisplayText rewrites stale Rearvy brand spelling", () => {
  assert.equal(normalizeRearvyDisplayText("rarville"), APP_NAME);
  assert.equal(normalizeRearvyDisplayText("  RARVILLE  "), APP_NAME);
});
