import test from "node:test";
import assert from "node:assert/strict";

import {
  doesRecordMatchQuery,
  normalizeWorkListenerDocument,
  normalizeWorkListenerInput,
  shouldRunListenerAutomatically,
} from "./listeners";

test("listener matching searches serialized record content", () => {
  assert.equal(doesRecordMatchQuery({ subject: "Customer reply", body: "Need MOQ details" }, "moq"), true);
  assert.equal(doesRecordMatchQuery({ subject: "Customer reply" }, "supplier"), false);
});

test("listener auto-run requires explicit trusted scope", () => {
  assert.equal(shouldRunListenerAutomatically({ auto_execute_enabled: true, trusted_scope: "trusted" }), true);
  assert.equal(shouldRunListenerAutomatically({ auto_execute_enabled: true, trusted_scope: "read_only" }), false);
  assert.equal(shouldRunListenerAutomatically({ auto_execute_enabled: false, trusted_scope: "trusted" }), false);
});

test("normalizeWorkListenerInput defaults source monitors to run_source", () => {
  const listener = normalizeWorkListenerInput({
    name: "Alibaba monitor",
    provider: "source",
    query: "supplier: textile $2 MOQ 500 pcs",
    schedule: "hourly",
    autoExecuteEnabled: true,
    trustedScope: "trusted",
  });

  assert.equal(listener.provider, "source");
  assert.equal(listener.action, "run_source");
  assert.equal(listener.schedule, "0 * * * *");
  assert.equal(listener.auto_execute_enabled, true);
  assert.equal(listener.trusted_scope, "trusted");
});

test("normalizeWorkListenerDocument tolerates broken timestamp values", () => {
  const listener = normalizeWorkListenerDocument("listener_1", {
    user_id: "user_1",
    name: "Lead replies",
    next_run_at: { toDate: () => new Date(Number.NaN) },
    last_run_at: { toDate: () => { throw new Error("bad timestamp"); } },
    created_at: { toDate: () => new Date(Number.NaN) },
    updated_at: { toDate: () => { throw new Error("bad timestamp"); } },
  });

  assert.equal(listener.id, "listener_1");
  assert.equal(listener.name, "Lead replies");
  assert.equal(listener.next_run_at, null);
  assert.equal(listener.last_run_at, null);
  assert.match(String(listener.created_at), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(listener.updated_at), /^\d{4}-\d{2}-\d{2}T/);
});
