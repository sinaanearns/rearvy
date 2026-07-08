/**
 * BrowserSessionStore
 *
 * Manages a secure, isolated workspace directory for browser automation
 * sessions. Each user gets their own sandboxed directory under the app's
 * user-data path, keeping cookies, localStorage and downloaded files
 * strictly separated per AGENTS.md §5.
 *
 * Directory layout:
 *   <appDataDir>/browser-sessions/<userId>/cookies/
 *   <appDataDir>/browser-sessions/<userId>/localStorage/
 *   <appDataDir>/browser-sessions/<userId>/downloads/
 */

"use strict";

const path = require("path");
const fs = require("fs/promises");
const { app } = require("electron");
const { createLogger } = require("./logger.cjs");

const log = createLogger("BrowserSessionStore");

// Validate that a userId is safe to use as a directory component.
// We only allow alphanumeric characters, hyphens, and underscores.
const SAFE_USER_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function validateUserId(userId) {
  if (!userId || !SAFE_USER_ID_RE.test(userId)) {
    throw new Error(
      `BrowserSessionStore: invalid userId "${userId}". Must match /^[a-zA-Z0-9_-]{1,128}$/`
    );
  }
}

class BrowserSessionStore {
  /**
   * @param {string} userId  - The authenticated user's UID.
   * @param {string} [baseDir] - Override the base directory (useful in tests).
   */
  constructor(userId, baseDir) {
    validateUserId(userId);
    this.userId = userId;

    const root = baseDir || app.getPath("userData");
    this.sessionDir = path.join(root, "browser-sessions", userId);
    this.cookieDir = path.join(this.sessionDir, "cookies");
    this.localStorageDir = path.join(this.sessionDir, "localStorage");
    this.downloadDir = path.join(this.sessionDir, "downloads");
  }

  /**
   * Ensures all session subdirectories exist.
   * Safe to call multiple times.
   */
  async init() {
    await Promise.all([
      fs.mkdir(this.cookieDir, { recursive: true }),
      fs.mkdir(this.localStorageDir, { recursive: true }),
      fs.mkdir(this.downloadDir, { recursive: true }),
    ]);
    log.info(`Session dirs ready for user ${this.userId} at ${this.sessionDir}`);
  }

  /**
   * Returns the Playwright / browser userDataDir path for this user.
   * Pass this to `chromium.launchPersistentContext({ userDataDir })`.
   */
  getUserDataDir() {
    return this.sessionDir;
  }

  /** Returns the download directory for this session. */
  getDownloadDir() {
    return this.downloadDir;
  }

  /**
   * Permanently wipes all session data for this user.
   * Used for "disconnect" or "clear session" flows.
   */
  async clearSession() {
    await fs.rm(this.sessionDir, { recursive: true, force: true });
    log.info(`Cleared browser session for user ${this.userId}`);
  }

  /**
   * Resolves a filename safely within the download directory,
   * preventing path traversal attacks.
   * @param {string} fileName
   * @returns {string} Safe absolute path inside downloadDir.
   */
  resolveDownloadPath(fileName) {
    const resolved = path.join(this.downloadDir, fileName);
    // Double-check no path traversal occurred
    if (!resolved.startsWith(this.downloadDir + path.sep) && resolved !== this.downloadDir) {
      throw new Error(`Unsafe download path: ${fileName}`);
    }
    return resolved;
  }
}

module.exports = { BrowserSessionStore, validateUserId };
