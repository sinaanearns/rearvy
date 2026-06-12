import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBrowserSessionId, parsePersistedSession } from "./session-store";

test("parsePersistedSession rejects malformed or incomplete session JSON", () => {
  assert.equal(parsePersistedSession("not-json"), null);
  assert.equal(parsePersistedSession("[]"), null);
  assert.equal(
    parsePersistedSession(JSON.stringify({ id: "session-1", createdAt: 1000 })),
    null
  );
  assert.equal(
    parsePersistedSession(JSON.stringify({ task: "open google", createdAt: 1000 })),
    null
  );
});

test("normalizeBrowserSessionId rejects path traversal and unsafe ids", () => {
  assert.equal(normalizeBrowserSessionId(" session_1-abc "), "session_1-abc");
  assert.equal(normalizeBrowserSessionId("../session-1"), null);
  assert.equal(normalizeBrowserSessionId("session/1"), null);
  assert.equal(normalizeBrowserSessionId("session.1"), null);
  assert.equal(normalizeBrowserSessionId(""), null);
});

test("parsePersistedSession rejects unsafe persisted ids", () => {
  assert.equal(
    parsePersistedSession(
      JSON.stringify({
        id: "../session-1",
        task: "open google",
        createdAt: 1000,
        stdout: [],
        stderr: [],
        isRunning: false,
      })
    ),
    null
  );
});

test("parsePersistedSession normalizes persisted browser session data", () => {
  assert.deepEqual(
    parsePersistedSession(
      JSON.stringify({
        id: " session-1 ",
        task: " open google ",
        createdAt: 1000,
        userId: "user-1",
        dedupeKey: null,
        strategy: "open-only",
        connectionMethod: "extension-relay",
        connectionStatus: "connected",
        connectedBrowser: {
          name: "Chrome",
          version: "120",
          webSocketDebuggerUrl: " ws://127.0.0.1:9222/devtools/browser/test ",
        },
        extensionRelay: {
          port: 18273,
          commandId: "command-1",
          extensionId: null,
        },
        stdout: ["ready", 123, "done"],
        stderr: ["warn", false],
        isRunning: true,
        pid: 42,
        status: "running",
        currentUrl: "https://google.com",
        title: "Google",
        summary: "Opened Google",
        screenshotDataUrl: "data:image/png;base64,abc",
        setupError: null,
        awaitingApproval: {
          id: "approval-1",
          reason: "Needs permission",
          command: null,
        },
        actionLog: [
          {
            id: "action-1",
            action: "navigate",
            status: "completed",
            message: "Opened page",
            timestamp: "2026-06-05T00:00:00.000Z",
          },
          { action: "missing id" },
        ],
        exitCode: null,
        exitedAt: 2000,
      })
    ),
    {
      id: "session-1",
      task: "open google",
      createdAt: 1000,
      userId: "user-1",
      dedupeKey: null,
      strategy: "open-only",
      connectionMethod: "extension-relay",
      connectionStatus: "connected",
      connectedBrowser: {
        name: "Chrome",
        version: "120",
        webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/test",
      },
      extensionRelay: {
        port: 18273,
        commandId: "command-1",
        extensionId: null,
      },
      stdout: ["ready", "done"],
      stderr: ["warn"],
      isRunning: true,
      pid: 42,
      status: "running",
      currentUrl: "https://google.com/",
      title: "Google",
      summary: "Opened Google",
      screenshotDataUrl: "data:image/png;base64,abc",
      setupError: null,
      awaitingApproval: {
        id: "approval-1",
        reason: "Needs permission",
        command: null,
      },
      actionLog: [
        {
          id: "action-1",
          action: "navigate",
          status: "completed",
          message: "Opened page",
          timestamp: "2026-06-05T00:00:00.000Z",
        },
      ],
      exitCode: null,
      exitedAt: 2000,
    }
  );
});

test("parsePersistedSession drops unsupported browser session enums", () => {
  const session = parsePersistedSession(
    JSON.stringify({
      id: "session-1",
      task: "open google",
      createdAt: 1000,
      strategy: "unsafe",
      connectionMethod: "unknown",
      stdout: [],
      stderr: [],
      isRunning: false,
    })
  );

  assert.equal(session?.strategy, undefined);
  assert.equal(session?.connectionMethod, undefined);
});

test("parsePersistedSession bounds persisted text and log fields", () => {
  const session = parsePersistedSession(
    JSON.stringify({
      id: "session-1",
      task: " open google ",
      createdAt: 1000,
      userId: " user\u0000-1 ",
      dedupeKey: " browser:test\r ",
      connectionStatus: " connected\n ",
      extensionRelay: {
        commandId: " command\u0000-1 ",
        extensionId: " extension\u0007-1 ",
      },
      stdout: Array.from({ length: 505 }, (_, index) => ` line-${index}\n `),
      stderr: Array.from({ length: 205 }, (_, index) => ` err-${index}\r `),
      isRunning: false,
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
    })
  );

  assert.equal(session?.userId, "user -1");
  assert.equal(session?.dedupeKey, "browser:test");
  assert.equal(session?.connectionStatus, "connected");
  assert.equal(session?.extensionRelay?.commandId, "command -1");
  assert.equal(session?.extensionRelay?.extensionId, "extension -1");
  assert.equal(session?.stdout.length, 500);
  assert.equal(session?.stdout[0], "line-5");
  assert.equal(session?.stderr.length, 200);
  assert.equal(session?.stderr[0], "err-5");
  assert.equal(session?.title, "Browser Title");
  assert.equal(session?.summary?.length, 2000);
  assert.equal(session?.setupError, "Error detail");
  assert.deepEqual(session?.awaitingApproval, {
    id: "approval -1",
    reason: "Need approval",
    command: "approve",
  });
  assert.equal(session?.actionLog?.length, 120);
  assert.deepEqual(session?.actionLog?.[0], {
    id: "action-5",
    action: "navigate",
    status: "completed",
    message: "m".repeat(4000),
    timestamp: "2026-06-05T00:00:00.000Z",
  });
});

test("parsePersistedSession normalizes safe screenshot data urls", () => {
  const session = parsePersistedSession(
    JSON.stringify({
      id: "session-1",
      task: "open google",
      createdAt: 1000,
      stdout: [],
      stderr: [],
      isRunning: false,
      screenshotDataUrl: " data:image/png;base64, abc123 ",
    })
  );

  assert.equal(session?.screenshotDataUrl, "data:image/png;base64,abc123");
});

test("parsePersistedSession rejects unsafe persisted screenshot data urls", () => {
  const session = parsePersistedSession(
    JSON.stringify({
      id: "session-1",
      task: "open google",
      createdAt: 1000,
      stdout: [],
      stderr: [],
      isRunning: false,
      screenshotDataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
    })
  );

  assert.equal(session?.screenshotDataUrl, null);
});

test("parsePersistedSession normalizes persisted current URLs", () => {
  assert.equal(
    parsePersistedSession(
      JSON.stringify({
        id: "session-1",
        task: "open google",
        createdAt: 1000,
        stdout: [],
        stderr: [],
        isRunning: false,
        currentUrl: " https://google.com/search?q=rearvy ",
      })
    )?.currentUrl,
    "https://google.com/search?q=rearvy"
  );

  assert.equal(
    parsePersistedSession(
      JSON.stringify({
        id: "session-1",
        task: "open settings",
        createdAt: 1000,
        stdout: [],
        stderr: [],
        isRunning: false,
        currentUrl: "chrome://settings",
      })
    )?.currentUrl,
    null
  );

  assert.equal(
    parsePersistedSession(
      JSON.stringify({
        id: "session-1",
        task: "open suspicious url",
        createdAt: 1000,
        stdout: [],
        stderr: [],
        isRunning: false,
        currentUrl: "https://trusted.example@evil.example/path",
      })
    )?.currentUrl,
    null
  );
});

test("parsePersistedSession normalizes connected browser debugger URLs", () => {
  assert.equal(
    parsePersistedSession(
      JSON.stringify({
        id: "session-1",
        task: "inspect browser",
        createdAt: 1000,
        stdout: [],
        stderr: [],
        isRunning: false,
        connectedBrowser: {
          webSocketDebuggerUrl: "wss://debug.example.com/devtools/browser/test",
        },
      })
    )?.connectedBrowser?.webSocketDebuggerUrl,
    "wss://debug.example.com/devtools/browser/test"
  );

  assert.equal(
    parsePersistedSession(
      JSON.stringify({
        id: "session-1",
        task: "inspect browser",
        createdAt: 1000,
        stdout: [],
        stderr: [],
        isRunning: false,
        connectedBrowser: {
          webSocketDebuggerUrl: "https://example.com/devtools/browser/test",
        },
      })
    )?.connectedBrowser?.webSocketDebuggerUrl,
    null
  );
});
