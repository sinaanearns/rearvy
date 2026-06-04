import test from "node:test";
import assert from "node:assert/strict";

import {
  isWorkSchedulerRequestAuthorized,
  normalizeSchedulerLimit,
} from "@/lib/work/scheduler-auth";

function makeRequest(url: string, headers?: Record<string, string>) {
  return {
    headers: new Headers(headers),
    nextUrl: new URL(url),
  };
}

test("normalizeSchedulerLimit clamps scheduler limits", () => {
  assert.equal(normalizeSchedulerLimit("0"), 1);
  assert.equal(normalizeSchedulerLimit("500"), 100);
  assert.equal(normalizeSchedulerLimit("bad"), 25);
  assert.equal(normalizeSchedulerLimit("12"), 12);
});

test("isWorkSchedulerRequestAuthorized accepts scheduler header or query secret", () => {
  assert.equal(
    isWorkSchedulerRequestAuthorized(
      makeRequest("https://example.com/api/internal/work/scheduler/run?run=1", {
        "x-work-scheduler-secret": "secret",
      }),
      "secret"
    ),
    true
  );
  assert.equal(
    isWorkSchedulerRequestAuthorized(
      makeRequest("https://example.com/api/internal/work/scheduler/run?run=1&secret=secret"),
      "secret"
    ),
    true
  );
  assert.equal(
    isWorkSchedulerRequestAuthorized(
      makeRequest("https://example.com/api/internal/work/scheduler/run?run=1", {
        "x-work-scheduler-secret": "wrong",
      }),
      "secret"
    ),
    false
  );
});
