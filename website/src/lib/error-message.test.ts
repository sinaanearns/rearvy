import assert from "node:assert/strict";
import { test } from "node:test";

import { getReadableErrorMessage } from "./error-message";

test("returns trimmed string errors", () => {
  assert.equal(getReadableErrorMessage("  boom  ", "fallback"), "boom");
});

test("falls back for blank string errors", () => {
  assert.equal(getReadableErrorMessage("   ", "fallback"), "fallback");
});

test("uses Error.message when present", () => {
  assert.equal(
    getReadableErrorMessage(new Error("  something failed  "), "fallback"),
    "something failed"
  );
});

test("walks Error.cause when the message is empty", () => {
  const error = new Error("", { cause: new Error("root cause") });
  assert.equal(getReadableErrorMessage(error, "fallback"), "root cause");
});

test("falls back when an Error has neither message nor cause", () => {
  assert.equal(getReadableErrorMessage(new Error(""), "fallback"), "fallback");
});

test("reads the first non-empty field from record-like errors", () => {
  assert.equal(
    getReadableErrorMessage({ message: "  ", error: "field error" }, "fallback"),
    "field error"
  );
  assert.equal(
    getReadableErrorMessage({ detail: "detail msg" }, "fallback"),
    "detail msg"
  );
  assert.equal(
    getReadableErrorMessage({ statusText: "Bad Gateway" }, "fallback"),
    "Bad Gateway"
  );
});

test("recurses into a record cause when no direct message exists", () => {
  assert.equal(
    getReadableErrorMessage({ cause: { reason: "nested reason" } }, "fallback"),
    "nested reason"
  );
});

test("falls back for arrays, null, numbers, and empty records", () => {
  assert.equal(getReadableErrorMessage(null, "fallback"), "fallback");
  assert.equal(getReadableErrorMessage(42, "fallback"), "fallback");
  assert.equal(getReadableErrorMessage(["a"], "fallback"), "fallback");
  assert.equal(getReadableErrorMessage({}, "fallback"), "fallback");
});
