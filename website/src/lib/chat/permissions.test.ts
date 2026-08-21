import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeChatPermissionMode,
  normalizeDesktopWorkspaceScope,
  loadStoredChatPermissionMode,
  saveStoredChatPermissionMode,
  CHAT_PERMISSION_MODE_STORAGE_KEY,
} from "./permissions.ts";

test("normalizeChatPermissionMode returns valid modes", () => {
  assert.equal(normalizeChatPermissionMode("full-access"), "full-access");
  assert.equal(normalizeChatPermissionMode("bypass"), "full-access");
  assert.equal(normalizeChatPermissionMode("approval"), "approval");
  assert.equal(normalizeChatPermissionMode("default"), "approval");
  assert.equal(normalizeChatPermissionMode("unknown"), "approval");
  assert.equal(normalizeChatPermissionMode(null), "approval");
  assert.equal(normalizeChatPermissionMode(undefined), "approval");
});

test("normalizeDesktopWorkspaceScope handles valid and fallback values", () => {
  const full = normalizeDesktopWorkspaceScope({ mode: "full-access", path: "/test" });
  assert.equal(full.mode, "full-access");
  assert.equal(full.path, "/test");

  const invalid = normalizeDesktopWorkspaceScope(null);
  assert.equal(invalid.mode, "folder");
  assert.equal(invalid.path, "");
});

test("loadStoredChatPermissionMode falls back safely when window is not defined", () => {
  assert.equal(loadStoredChatPermissionMode(), "approval");
});
