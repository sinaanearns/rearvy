/**
 * Tests for BrowserSessionStore (no Electron dependency required for
 * core logic — we override the baseDir to use a temp directory).
 */
"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const os = require("os");
const path = require("path");
const fs = require("fs/promises");

// Stub out electron's app module before requiring BrowserSessionStore
const tempBase = path.join(os.tmpdir(), `bss-test-${Date.now()}`);

// Minimal electron stub
require.cache[require.resolve("electron")] = {
  exports: { app: { getPath: () => tempBase } },
  id: require.resolve("electron"),
  filename: require.resolve("electron"),
  loaded: true,
  parent: null,
  children: [],
  paths: [],
};

const { BrowserSessionStore, validateUserId } = require("./browser-session-store.cjs");

test("validateUserId rejects empty string", () => {
  assert.throws(() => validateUserId(""), /invalid userId/);
});

test("validateUserId rejects path traversal", () => {
  assert.throws(() => validateUserId("../evil"), /invalid userId/);
});

test("validateUserId accepts normal UIDs", () => {
  assert.doesNotThrow(() => validateUserId("user-123_abc"));
});

test("init creates all session subdirectories", async () => {
  const store = new BrowserSessionStore("test-user-1", tempBase);
  await store.init();

  const [cookieStat, lsStat, dlStat] = await Promise.all([
    fs.stat(path.join(store.getUserDataDir(), "cookies")),
    fs.stat(path.join(store.getUserDataDir(), "localStorage")),
    fs.stat(store.getDownloadDir()),
  ]);

  assert.ok(cookieStat.isDirectory(), "cookies dir should exist");
  assert.ok(lsStat.isDirectory(), "localStorage dir should exist");
  assert.ok(dlStat.isDirectory(), "downloads dir should exist");
});

test("resolveDownloadPath prevents path traversal", () => {
  const store = new BrowserSessionStore("test-user-2", tempBase);
  // Should throw on traversal attempt
  assert.throws(() => store.resolveDownloadPath("../../evil.txt"), /Unsafe/);
});

test("resolveDownloadPath returns safe path for normal filename", async () => {
  const store = new BrowserSessionStore("test-user-3", tempBase);
  await store.init();
  const result = store.resolveDownloadPath("report.pdf");
  assert.ok(result.startsWith(store.getDownloadDir()), "must be inside downloadDir");
  assert.ok(result.endsWith("report.pdf"));
});

test("clearSession removes session directory", async () => {
  const store = new BrowserSessionStore("test-user-clear", tempBase);
  await store.init();
  await store.clearSession();
  await assert.rejects(
    () => fs.stat(store.getUserDataDir()),
    { code: "ENOENT" }
  );
});
