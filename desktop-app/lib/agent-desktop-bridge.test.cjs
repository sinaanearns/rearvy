/**
 * agent-desktop-bridge.test.cjs
 *
 * Unit tests for the agent-desktop bridge.
 * Mocks child_process.spawn so no real binary is required.
 */

"use strict";

const assert = require("assert");
const { describe, it, before, after, mock } = require("node:test");
const path = require("path");
const { EventEmitter } = require("events");

// ─── Spawn mock factory ────────────────────────────────────────────────────────

/**
 * Build a fake spawn that returns a process that emits the given JSON on stdout.
 * @param {object|string} response  Parsed JSON or raw string
 * @param {number} [exitCode=0]
 */
function makeSpawnMock(response, exitCode = 0) {
  const raw = typeof response === "string" ? response : JSON.stringify(response);

  return function fakeSpawn(_bin, _args, _opts) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    setImmediate(() => {
      child.stdout.emit("data", Buffer.from(raw + "\n"));
      child.emit("close", exitCode);
    });

    return child;
  };
}

// ─── Module under test (loaded with mocked spawn) ─────────────────────────────

describe("agent-desktop-bridge", () => {
  let bridge;
  let originalSpawn;

  before(() => {
    // Ensure the module isn't cached from an earlier test run
    delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
  });

  // ─── healthCheck ─────────────────────────────────────────────────────────────

  describe("healthCheck()", () => {
    it("returns available=true when binary responds with version envelope", async () => {
      // Patch child_process before loading bridge
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = makeSpawnMock({
        ok: true,
        command: "version",
        version: "0.1.0",
        data: { version: "0.1.0", os: "windows" },
      });

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      const result = await bridge.healthCheck();
      assert.strictEqual(result.available, true);
      assert.strictEqual(result.version, "0.1.0");

      cp.spawn = originalSpawn;
    });

    it("returns available=false when spawn throws", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = function () {
        throw new Error("binary not found");
      };

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      const result = await bridge.healthCheck();
      assert.strictEqual(result.available, false);
      assert.ok(result.error.includes("binary not found"));

      cp.spawn = originalSpawn;
    });
  });

  // ─── clipboardGet ─────────────────────────────────────────────────────────────

  describe("clipboardGet()", () => {
    it("resolves with clipboard data on success", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = makeSpawnMock({
        ok: true,
        command: "clipboard-get",
        version: "0.1.0",
        data: "hello world",
      });

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      const result = await bridge.clipboardGet();
      assert.strictEqual(result, "hello world");

      cp.spawn = originalSpawn;
    });

    it("throws an error when ok:false", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = makeSpawnMock({
        ok: false,
        command: "clipboard-get",
        version: "0.1.0",
        error: { code: "PERM_DENIED", message: "Accessibility not granted" },
      });

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      await assert.rejects(
        () => bridge.clipboardGet(),
        (err) => {
          assert.ok(err.message.includes("PERM_DENIED"));
          assert.strictEqual(err.code, "PERM_DENIED");
          return true;
        }
      );

      cp.spawn = originalSpawn;
    });
  });

  // ─── clipboardSet ─────────────────────────────────────────────────────────────

  describe("clipboardSet()", () => {
    it("calls the CLI with the correct args and resolves on success", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      let capturedArgs;

      cp.spawn = function (bin, args, opts) {
        capturedArgs = args;
        return makeSpawnMock({
          ok: true,
          command: "clipboard-set",
          version: "0.1.0",
          data: null,
        })(bin, args, opts);
      };

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      await bridge.clipboardSet("test text");
      assert.ok(capturedArgs.includes("clipboard-set"));
      assert.ok(capturedArgs.includes("test text"));

      cp.spawn = originalSpawn;
    });
  });

  // ─── runCommand ──────────────────────────────────────────────────────────────

  describe("runCommand()", () => {
    it("resolves with parsed JSON envelope from stdout", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      const envelope = { ok: true, command: "status", version: "0.1.0", data: { platform: "windows" } };
      cp.spawn = makeSpawnMock(envelope);

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      const result = await bridge.runCommand(["status"]);
      assert.deepStrictEqual(result, envelope);

      cp.spawn = originalSpawn;
    });

    it("rejects when the process emits no output", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = function () {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        setImmediate(() => child.emit("close", 0));
        return child;
      };

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      await assert.rejects(() => bridge.runCommand(["version"]), /no output/);

      cp.spawn = originalSpawn;
    });

    it("rejects on non-JSON output", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = makeSpawnMock("Error: binary crashed", 1);

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      await assert.rejects(() => bridge.runCommand(["version"]), /non-JSON/);

      cp.spawn = originalSpawn;
    });

    it("rejects on timeout", async () => {
      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = function () {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = () => {};
        // Never emits close
        return child;
      };

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      await assert.rejects(
        () => bridge.runCommand(["version"], { timeoutMs: 50 }),
        /timed out/
      );

      cp.spawn = originalSpawn;
    });
  });

  // ─── listWindows ─────────────────────────────────────────────────────────────

  describe("listWindows()", () => {
    it("resolves with an array of window objects", async () => {
      const windows = [
        { id: 1, title: "Notepad", app: "notepad" },
        { id: 2, title: "Calculator", app: "calculator" },
      ];

      const cp = require("child_process");
      const originalSpawn = cp.spawn;
      cp.spawn = makeSpawnMock({
        ok: true,
        command: "list-windows",
        version: "0.1.0",
        data: { windows },
      });

      delete require.cache[require.resolve("./agent-desktop-bridge.cjs")];
      bridge = require("./agent-desktop-bridge.cjs");

      const result = await bridge.listWindows();
      assert.deepStrictEqual(result.windows, windows);

      cp.spawn = originalSpawn;
    });
  });
});
