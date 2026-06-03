import assert from "node:assert/strict";
import test from "node:test";

import {
  captureRelayScreenshotEvidence,
  findReusableBrowserSession,
  serializeSession,
  waitForRelayCommand,
  type BrowserSession,
} from "./sessionManager.ts";

function buildTestSession(overrides: Partial<BrowserSession> = {}): BrowserSession {
  return {
    id: "session_1",
    task: "capture competitor screenshots",
    createdAt: Date.now(),
    userId: "user_1",
    dedupeKey: "browser:test",
    strategy: "goal-seeking",
    connectionMethod: "extension-relay",
    connectionStatus: "connected",
    connectedBrowser: null,
    extensionRelay: { port: 8765, commandId: null, extensionId: "ext_1" },
    stdout: [],
    stderr: [],
    status: "completed",
    currentUrl: "https://example.com",
    title: "Example",
    summary: "Captured evidence.",
    screenshotDataUrl: null,
    setupError: null,
    awaitingApproval: null,
    actionLog: [],
    exitCode: 0,
    exitedAt: Date.now(),
    ...overrides,
  };
}

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

test("serializes browser screenshot evidence", () => {
  const session = buildTestSession({
    screenshotDataUrl: "data:image/png;base64,abc123",
  });

  assert.equal(
    serializeSession(session).screenshotDataUrl,
    "data:image/png;base64,abc123"
  );
});

test("captureRelayScreenshotEvidence stores browser screenshot evidence", async () => {
  const originalFetch = globalThis.fetch;
  const session = buildTestSession();
  const calls: string[] = [];

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlText = String(url);
    calls.push(urlText);
    if (urlText.endsWith("/command")) {
      return new Response(
        JSON.stringify({ ok: true, command: { id: "cmd_screenshot" } })
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        command: {
          id: "cmd_screenshot",
          status: "completed",
          result: { screenshot: "data:image/png;base64,screen" },
        },
      })
    );
  }) as typeof fetch;

  try {
    assert.equal(await captureRelayScreenshotEvidence(session), true);
    assert.equal(session.screenshotDataUrl, "data:image/png;base64,screen");
    assert.equal(
      session.actionLog.some(
        (entry) => entry.action === "screenshot" && entry.status === "completed"
      ),
      true
    );
    assert.equal(
      session.actionLog.some(
        (entry) =>
          entry.action === "evidence" &&
          entry.message.includes("Title: Example") &&
          entry.message.includes("URL: https://example.com") &&
          entry.message.includes("Screenshot: captured")
      ),
      true
    );
    assert.equal(calls.length >= 2, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
