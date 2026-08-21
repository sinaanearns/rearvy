import assert from "node:assert/strict";
import test from "node:test";
import { ingestDocument } from "./ingestion-pipeline";

test("ingestDocument exports ingestion function", () => {
  assert.equal(typeof ingestDocument, "function");
});
