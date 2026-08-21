import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAgentEventDocId,
  calculateNextRetryAt,
  isRunnableAgentEvent,
} from "./store.ts";
import type { AgentEvent } from "./types.ts";

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

test("isRunnableAgentEvent only allows due unclaimed events", () => {
  const nowIso = "2026-01-01T00:00:00.000Z";
  const baseEvent: AgentEvent = {
    id: "event-1",
    user_id: "user-1",
    project_id: null,
    type: "webhook",
    source: "webhook",
    dedupe_key: null,
    priority: 5,
    status: "pending",
    payload: {},
    attempt_count: 0,
    max_attempts: 3,
    next_run_at: nowIso,
    last_error: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  assert.equal(isRunnableAgentEvent(baseEvent, nowIso), true);
  assert.equal(
    isRunnableAgentEvent({ ...baseEvent, status: "processing" }, nowIso),
    false
  );
  assert.equal(
    isRunnableAgentEvent({ ...baseEvent, next_run_at: "2026-01-01T00:01:00.000Z" }, nowIso),
    false
  );
  assert.equal(
    isRunnableAgentEvent({ ...baseEvent, attempt_count: 3 }, nowIso),
    false
  );
  assert.equal(isRunnableAgentEvent(baseEvent, nowIso, "other-user"), false);
});
