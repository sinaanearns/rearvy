import assert from "node:assert/strict";
import test from "node:test";

import {
  findReusableBrowserSession,
  waitForRelayCommand,
} from "./sessionManager.ts";

test("same dedupe key reuses active or completed browser sessions", () => {
  assert.equal(
    findReusableBrowserSession("browser:1", [
      {
        id: "failed",
        dedupeKey: "browser:1",
        status: "failed",
        isRunning: false,
        exitCode: 1,
      },
      {
        id: "active",
        dedupeKey: "browser:1",
        status: "running",
        isRunning: true,
        exitCode: null,
      },
    ])?.id,
    "active"
  );

  assert.equal(
    findReusableBrowserSession("browser:2", [
      {
        id: "done",
        dedupeKey: "browser:2",
        status: "completed",
        isRunning: false,
        exitCode: 0,
      },
    ])?.id,
    "done"
  );
});

test("relay command polling returns completed command output", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        ok: true,
        command:
          calls === 1
            ? { id: "cmd_1", status: "sent" }
            : { id: "cmd_1", status: "completed", result: { title: "Ready" } },
      })
    );
  };

  const command = await waitForRelayCommand("cmd_1", {
    baseUrl: "http://127.0.0.1:1",
    fetchImpl: fetchImpl as typeof fetch,
    pollMs: 1,
    timeoutMs: 1000,
  });

  assert.equal(command.status, "completed");
  assert.deepEqual(command.result, { title: "Ready" });
});

test("relay command polling rejects failed and timed-out commands", async () => {
  await assert.rejects(
    waitForRelayCommand("cmd_failed", {
      baseUrl: "http://127.0.0.1:1",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            ok: true,
            command: { id: "cmd_failed", status: "failed", error: "bad selector" },
          })
        )) as typeof fetch,
      pollMs: 1,
      timeoutMs: 50,
    }),
    /bad selector/
  );

  await assert.rejects(
    waitForRelayCommand("cmd_timeout", {
      baseUrl: "http://127.0.0.1:1",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            ok: true,
            command: { id: "cmd_timeout", status: "sent" },
          })
        )) as typeof fetch,
      pollMs: 1,
      timeoutMs: 5,
    }),
    /timed out/
  );
});
