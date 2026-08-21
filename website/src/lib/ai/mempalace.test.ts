import assert from "node:assert/strict";
import test from "node:test";
import { extractJsonResult } from "./mempalace";

test("extractJsonResult returns the last valid JSON object line", () => {
  assert.deepEqual(
    extractJsonResult(
      [
        "starting bridge",
        '{"ok":false,"error":"old"}',
        "progress",
        '{"ok":true,"wakeUp":"ready"}',
      ].join("\n")
    ),
    { ok: true, wakeUp: "ready" }
  );
});

test("extractJsonResult ignores malformed and non-object JSON lines", () => {
  assert.deepEqual(
    extractJsonResult(
      [
        "starting bridge",
        "[1,2,3]",
        '{"ok":',
        '{"ok":false,"error":"usable"}',
      ].join("\n")
    ),
    { ok: false, error: "usable" }
  );
});

test("extractJsonResult returns null when no JSON object is present", () => {
  assert.equal(extractJsonResult("plain output\n[1,2,3]\n"), null);
});
