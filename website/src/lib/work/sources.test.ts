import test from "node:test";
import assert from "node:assert/strict";

import { extractSupplierSignals, normalizeSourceTaskDocument } from "./sources";

test("extractSupplierSignals finds supplier price and MOQ text", () => {
  const signals = extractSupplierSignals("Supplier: Shenzhen Parts Factory price $2.40 - $3.10 MOQ 500 pcs");

  assert.equal(signals.supplier, "Shenzhen Parts Factory");
  assert.equal(signals.price, "$2.40 - $3.10");
  assert.equal(signals.moq, "MOQ 500 pcs");
});

test("normalizeSourceTaskDocument tolerates broken timestamp values", () => {
  const task = normalizeSourceTaskDocument("source-task-1", {
    user_id: "user_1",
    provider: "reddit",
    query: "supplier leads",
    created_at: { toDate: () => new Date("invalid") },
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    started_at: { toDate: () => new Date("2026-01-03T00:00:00.000Z") },
    finished_at: { toDate: () => new Date("invalid") },
  });

  assert.equal(task.id, "source-task-1");
  assert.equal(task.provider, "reddit");
  assert.match(task.created_at.toString(), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(task.updated_at, "2026-01-02T00:00:00.000Z");
  assert.equal(task.started_at, "2026-01-03T00:00:00.000Z");
  assert.equal(task.finished_at, null);
});
