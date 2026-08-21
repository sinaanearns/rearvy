import assert from "node:assert/strict";
import test from "node:test";

import {
  captureRelayScreenshotEvidence,
  commandToRelayAction,
  findReusableBrowserSession,
  parseRunnerEvent,
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

test("serializeSession normalizes live browser session URLs", () => {
  const session = buildTestSession({
    currentUrl: " https://example.com/path ",
    screenshotDataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
    connectedBrowser: {
      name: " Chrome ",
      version: " 120 ",
      webSocketDebuggerUrl: "https://example.com/devtools/browser/test",
    },
  });

  const serialized = serializeSession(session);

  assert.equal(serialized.currentUrl, "https://example.com/path");
  assert.equal(serialized.screenshotDataUrl, null);
  assert.deepEqual(serialized.connectedBrowser, {
    name: "Chrome",
    version: "120",
    webSocketDebuggerUrl: null,
  });
});

test("serializeSession bounds live browser session text and logs", () => {
  const session = buildTestSession({
    task: " open google\u0000 ",
    userId: " user\u0000-1 ",
    dedupeKey: " browser:test\r ",
    connectionStatus: " connected\n ",
    extensionRelay: {
      port: 8765,
      commandId: " command\u0000-1 ",
      extensionId: " extension\u0007-1 ",
    },
    stdout: Array.from({ length: 505 }, (_, index) => ` line-${index}\n `),
    stderr: Array.from({ length: 205 }, (_, index) => ` err-${index}\r `),
    status: " completed\t ",
    title: " Browser\u001fTitle ",
    summary: "s".repeat(2100),
    setupError: " Error\u0000detail ",
    awaitingApproval: {
      id: " approval\u0000-1 ",
      reason: " Need\rapproval ",
      command: " approve\n ",
    },
    actionLog: Array.from({ length: 125 }, (_, index) => ({
      id: ` action-${index}\n `,
      action: " navigate\t ",
      status: " completed\r ",
      message: "m".repeat(4100),
      timestamp: " 2026-06-05T00:00:00.000Z\n ",
    })),
  });

  const serialized = serializeSession(session);

  assert.equal(serialized.task, "open google");
  assert.equal(serialized.userId, "user -1");
  assert.equal(serialized.dedupeKey, "browser:test");
  assert.equal(serialized.connectionStatus, "connected");
  assert.equal(serialized.extensionRelay?.commandId, "command -1");
  assert.equal(serialized.extensionRelay?.extensionId, "extension -1");
  assert.equal(serialized.stdout.length, 500);
  assert.equal(serialized.stdout[0], "line-5");
  assert.equal(serialized.stderr.length, 200);
  assert.equal(serialized.stderr[0], "err-5");
  assert.equal(serialized.status, "completed");
  assert.equal(serialized.title, "Browser Title");
  assert.equal(serialized.summary?.length, 2000);
  assert.equal(serialized.setupError, "Error detail");
  assert.deepEqual(serialized.awaitingApproval, {
    id: "approval -1",
    reason: "Need approval",
    command: "approve",
  });
  assert.equal(serialized.actionLog?.length, 120);
  assert.deepEqual(serialized.actionLog?.[0], {
    id: "action-5",
    action: "navigate",
    status: "completed",
    message: "m".repeat(4000),
    timestamp: "2026-06-05T00:00:00.000Z",
  });
});

test("commandToRelayAction preserves JSON commands and infers plain text commands", () => {
  assert.deepEqual(
    commandToRelayAction('{"type":"clickText","target":"Sign in"}'),
    { type: "clickText", target: "Sign in" }
  );
  assert.deepEqual(
    commandToRelayAction('{"type":"navigate","url":" https://example.com/path "}'),
    { type: "navigate", url: "https://example.com/path" }
  );
  assert.deepEqual(
    commandToRelayAction('{"type":"navigate","url":"javascript:alert(1)"}'),
    { type: "scanPage" }
  );
  assert.deepEqual(commandToRelayAction("open google.com"), {
    type: "navigate",
    url: "https://google.com/",
  });
  assert.deepEqual(commandToRelayAction("open https://trusted.example@evil.example"), {
    type: "scanPage",
  });
  assert.deepEqual(commandToRelayAction("scroll down"), {
    type: "scroll",
    direction: "down",
    amount: 720,
  });
  assert.deepEqual(commandToRelayAction("not valid { json"), {
    type: "scanPage",
  });
});

test("parseRunnerEvent accepts JSON records only", () => {
  assert.deepEqual(parseRunnerEvent('{"status":"running","message":"Ready"}'), {
    status: "running",
    message: "Ready",
  });
  assert.equal(parseRunnerEvent("not-json"), null);
  assert.equal(parseRunnerEvent("[]"), null);
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

test("captureRelayScreenshotEvidence rejects unsafe screenshot data urls", async () => {
  const originalFetch = globalThis.fetch;
  const session = buildTestSession();

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlText = String(url);
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
          result: { screenshot: "data:image/svg+xml;base64,PHN2Zz4=" },
        },
      })
    );
  }) as typeof fetch;

  try {
    assert.equal(await captureRelayScreenshotEvidence(session), false);
    assert.equal(session.screenshotDataUrl, null);
    assert.equal(
      session.actionLog.some(
        (entry) =>
          entry.action === "evidence" &&
          entry.message.includes("Screenshot: captured")
      ),
      false
    );
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
