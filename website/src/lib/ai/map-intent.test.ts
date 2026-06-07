import assert from "node:assert/strict";
import test from "node:test";

import { detectMapGenerationIntent } from "./map-intent";

test("detects JP Morgan company-location map requests", () => {
  const intent = detectMapGenerationIntent(
    "show me jp morgan company locations on a map"
  );

  assert.ok(intent);
  assert.equal(intent.source, "jp-morgan-example");
  assert.equal(intent.input.title, "JPMorgan Chase major company locations");
  assert.ok(intent.input.markers.length >= 8);
  assert.ok(intent.input.markers.some((marker) => marker.label === "New York"));
  assert.ok(intent.input.markers.some((marker) => marker.label === "London"));
});

test("ignores unrelated map wording", () => {
  assert.equal(
    detectMapGenerationIntent("map over this array in TypeScript"),
    null
  );
});

test("does not treat non-location JP Morgan questions as map requests", () => {
  assert.equal(detectMapGenerationIntent("show me JP Morgan stock price"), null);
});
