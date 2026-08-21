import assert from "node:assert/strict";
import test from "node:test";
import { generateSmartReplies } from "./smart-reply";

test("generateSmartReplies exports function", () => {
  assert.equal(typeof generateSmartReplies, "function");
});
