import test from "node:test";
import assert from "node:assert/strict";

import { normalizeProcessSessionInput, processCanStart } from "./processes";

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
