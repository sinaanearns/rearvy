import test from "node:test";
import assert from "node:assert/strict";

import {
  doesRecordMatchQuery,
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
