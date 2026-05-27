import assert from "node:assert/strict";
import test from "node:test";
import { safeDocId } from "./doc-utils";

test("safeDocId sanitizes unsafe Firestore id characters", () => {
  assert.equal(safeDocId("integration/id", "row id"), "integration_id_row_id");
});

test("safeDocId never returns an empty Firestore id", () => {
  assert.equal(safeDocId(undefined, null), "unknown");
});
