import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAgentEventDocId,
  calculateNextRetryAt,
} from "./store.ts";

test("agent event doc IDs are stable for dedupe keys", () => {
  const first = buildAgentEventDocId({
    userId: "user/123",
    type: "webhook",
    dedupeKey: "shopify/order/1001",
  });
  const second = buildAgentEventDocId({
    userId: "user/123",
    type: "webhook",
    dedupeKey: "shopify/order/1001",
  });

  assert.equal(first, second);
  assert.equal(first.includes("/"), false);
});

test("agent event retry backoff stops at max attempts", () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);

  assert.equal(
    calculateNextRetryAt(1, 5, nowMs),
    new Date(nowMs + 60 * 1000).toISOString()
  );
  assert.equal(
    calculateNextRetryAt(3, 5, nowMs),
    new Date(nowMs + 4 * 60 * 1000).toISOString()
  );
  assert.equal(calculateNextRetryAt(5, 5, nowMs), null);
});
