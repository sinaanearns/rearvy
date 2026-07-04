import assert from "node:assert/strict";
import test from "node:test";
import { writeAuditEvent } from "./writer";

test("writeAuditEvent exports function", () => {
  assert.equal(typeof writeAuditEvent, "function");
});
