import assert from "node:assert/strict";
import test from "node:test";

import { waitForBrowserbaseSessionReady } from "./browserbase-session";

test("waitForBrowserbaseSessionReady resolves once the session reaches RUNNING", async () => {
  let calls = 0;
  const snapshot = await waitForBrowserbaseSessionReady(
    async () => {
      calls += 1;
      return calls === 1
        ? { id: "session-1", status: "PENDING" }
        : { id: "session-1", status: "RUNNING" };
    },
    "session-1",
    { timeoutMs: 1000, intervalMs: 1 }
  );

  assert.equal(snapshot.status, "RUNNING");
  assert.equal(calls, 2);
});

test("waitForBrowserbaseSessionReady throws a clear error when the session never becomes ready", async () => {
  await assert.rejects(
    () =>
      waitForBrowserbaseSessionReady(
        async () => ({ id: "session-1", status: "PENDING" }),
        "session-1",
        { timeoutMs: 10, intervalMs: 1 }
      ),
    /did not become ready/i
  );
});
