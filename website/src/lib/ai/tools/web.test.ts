import assert from "node:assert/strict";
import test from "node:test";

import { buildSpecializedWebSearchQuery } from "./web.ts";

test("buildSpecializedWebSearchQuery preserves general searches", () => {
  assert.equal(
    buildSpecializedWebSearchQuery("rearvy automation", "general"),
    "rearvy automation"
  );
});

test("buildSpecializedWebSearchQuery biases specialized searches", () => {
  assert.equal(
    buildSpecializedWebSearchQuery("shopify retention benchmarks", "academic"),
    "shopify retention benchmarks research paper study"
  );
  assert.equal(
    buildSpecializedWebSearchQuery("google analytics", "apis"),
    "google analytics API documentation developer reference"
  );
  assert.equal(
    buildSpecializedWebSearchQuery("DTC growth", "datasets"),
    "DTC growth public dataset data source"
  );
});

test("buildSpecializedWebSearchQuery does not double-append explicit operators", () => {
  assert.equal(
    buildSpecializedWebSearchQuery("shopify retention site:example.com", "news"),
    "shopify retention site:example.com"
  );
  assert.equal(
    buildSpecializedWebSearchQuery("brand API documentation", "apis"),
    "brand API documentation"
  );
});
