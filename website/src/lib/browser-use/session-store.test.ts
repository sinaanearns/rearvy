import assert from "node:assert/strict";
import test from "node:test";
import { parsePersistedSession } from "./session-store";

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
          webSocketDebuggerUrl: 123,
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
        webSocketDebuggerUrl: undefined,
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
