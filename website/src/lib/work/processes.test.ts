import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProcessSessionDocument,
  normalizeProcessSessionInput,
  processCanStart,
} from "./processes";

test("process sessions only auto-start when trusted", () => {
  const session = normalizeProcessSessionInput({
    command: "npm run lint",
    autoExecuteEnabled: true,
    trustedScope: "trusted",
  });

  assert.equal(session.command, "npm run lint");
  assert.equal(processCanStart(session), true);
  assert.equal(processCanStart({ ...session, trusted_scope: "read_only" }), false);
});

test("process session document normalization tolerates broken timestamp values", () => {
  const session = normalizeProcessSessionDocument("process_1", {
    user_id: "user_1",
    command: "npm run test",
    created_at: { toDate: () => new Date(Number.NaN) },
    updated_at: { toDate: () => { throw new Error("bad timestamp"); } },
    started_at: { toDate: () => new Date(Number.NaN) },
    finished_at: { toDate: () => { throw new Error("bad timestamp"); } },
  });

  assert.equal(session.id, "process_1");
  assert.equal(session.command, "npm run test");
  assert.match(String(session.created_at), /^\d{4}-\d{2}-\d{2}T/);
  assert.match(String(session.updated_at), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(session.started_at, null);
  assert.equal(session.finished_at, null);
});
