/**
 * agent-desktop-bridge.cjs
 *
 * Production-ready Node.js bridge for the agent-desktop Rust CLI.
 * Spawns the binary, streams its line-delimited JSON output, and exposes
 * typed wrappers for every supported command.
 *
 * Binary resolution order:
 *   1. AGENT_DESKTOP_BIN env var (CI / custom installs)
 *   2. Electron resourcesPath  → resources/agent-desktop/agent-desktop.exe
 *   3. Dev fallback            → ../agent-desktop/target/release/agent-desktop.exe
 */

"use strict";

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const { createLogger } = require("./logger.cjs");

const log = createLogger("AgentDesktop");

// ─── Binary resolution ────────────────────────────────────────────────────────

const BINARY_NAME = process.platform === "win32" ? "agent-desktop.exe" : "agent-desktop";

function resolveBinaryPath() {
  if (process.env.AGENT_DESKTOP_BIN) {
    return process.env.AGENT_DESKTOP_BIN;
  }

  // Packaged Electron app
  if (process.resourcesPath) {
    const packed = path.join(process.resourcesPath, "agent-desktop", BINARY_NAME);
    try {
      require("fs").accessSync(packed);
      return packed;
    } catch {
      // Not found in resourcesPath — fall through to dev path
    }
  }

  // Dev: binary built from the cloned agent-desktop repo
  return path.join(__dirname, "..", "..", "agent-desktop", "target", "release", BINARY_NAME);
}

let _resolvedBin = null;
function getBinaryPath() {
  if (!_resolvedBin) {
    _resolvedBin = resolveBinaryPath();
    log.info("agent-desktop binary resolved:", _resolvedBin);
  }
  return _resolvedBin;
}

// ─── Core runner ─────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024; // 4 MB guard

/**
 * Run an agent-desktop command and return its parsed JSON response.
 *
 * @param {string[]} args        CLI argument array, e.g. ["snapshot", "--app", "Finder", "-i"]
 * @param {object}   [options]
 * @param {number}   [options.timeoutMs]         Max ms to wait (default 30 s)
 * @param {string}   [options.sessionId]         Inject AGENT_DESKTOP_SESSION env var
 * @param {boolean}  [options.headed]            Prepend --headed flag
 * @param {Record}   [options.env]               Extra env vars merged into process.env
 * @returns {Promise<object>}    Parsed JSON envelope { version, ok, command, data | error }
 */
async function runCommand(args, options = {}) {
  const bin = getBinaryPath();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const cliArgs = [];
  if (options.headed) cliArgs.push("--headed");
  cliArgs.push(...args);

  const env = {
    ...process.env,
    ...(options.env ?? {}),
  };
  if (options.sessionId) {
    env.AGENT_DESKTOP_SESSION = options.sessionId;
  }

  log.debug("agent-desktop run:", bin, cliArgs.join(" "));

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const child = spawn(bin, cliArgs, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`agent-desktop timed out after ${timeoutMs}ms: ${cliArgs.join(" ")}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > MAX_OUTPUT_BYTES) {
        try { child.kill(); } catch { /* ignore */ }
        reject(new Error("agent-desktop output exceeded 4 MB safety limit"));
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if (!timedOut) {
        reject(
          new Error(`Failed to spawn agent-desktop (${bin}): ${err.message}`)
        );
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (stderr.trim()) {
        log.debug("agent-desktop stderr:", stderr.trim().slice(0, 500));
      }

      const line = stdout.trim();
      if (!line) {
        reject(new Error(`agent-desktop exited ${code} with no output. Args: ${cliArgs.join(" ")}`));
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        reject(
          new Error(
            `agent-desktop returned non-JSON (exit ${code}): ${line.slice(0, 300)}`
          )
        );
        return;
      }

      // The CLI always emits { ok: true|false, ... }
      // Resolve even on ok:false so callers can inspect the error code.
      resolve(parsed);
    });
  });
}

// ─── Result helpers ───────────────────────────────────────────────────────────

function assertOk(result, label) {
  if (!result.ok) {
    const msg = result.error?.message ?? JSON.stringify(result.error ?? result);
    const code = result.error?.code ?? "UNKNOWN";
    const err = new Error(`agent-desktop ${label} failed [${code}]: ${msg}`);
    err.code = code;
    err.agentDesktopResult = result;
    throw err;
  }
  return result.data ?? result;
}

// ─── Observation commands ─────────────────────────────────────────────────────

/**
 * Capture an accessibility tree snapshot.
 * @param {string|null} app       App name filter, e.g. "Finder"
 * @param {object} [opts]
 * @param {boolean} [opts.interactive]  Only include interactive elements
 * @param {boolean} [opts.compact]      Compact output
 * @param {boolean} [opts.skeleton]     Skeleton mode (shallow + drill-down)
 * @param {string}  [opts.sessionId]
 */
async function snapshot(app, opts = {}) {
  const args = ["snapshot"];
  if (app) args.push("--app", app);
  if (opts.interactive) args.push("-i");
  if (opts.compact) args.push("--compact");
  if (opts.skeleton) args.push("--skeleton");
  const result = await runCommand(args, { sessionId: opts.sessionId, timeoutMs: opts.timeoutMs });
  return assertOk(result, "snapshot");
}

/**
 * Find elements by role/name/value/text.
 * @param {object} filter  { role?, name?, value?, text?, app?, limit? }
 * @param {object} [opts]
 */
async function find(filter = {}, opts = {}) {
  const args = ["find"];
  if (filter.role) args.push("--role", filter.role);
  if (filter.name) args.push("--name", filter.name);
  if (filter.value) args.push("--value", filter.value);
  if (filter.text) args.push("--text", filter.text);
  if (filter.app) args.push("--app", filter.app);
  if (filter.limit) args.push("--limit", String(filter.limit));
  const result = await runCommand(args, { sessionId: opts.sessionId });
  return assertOk(result, "find");
}

/**
 * Take a screenshot.
 * @param {object} [opts]  { app?, windowId?, displayIndex?, sessionId? }
 */
async function screenshot(opts = {}) {
  const args = ["screenshot"];
  if (opts.app) args.push("--app", opts.app);
  if (opts.windowId) args.push("--window-id", opts.windowId);
  if (opts.displayIndex != null) args.push("--display", String(opts.displayIndex));
  const result = await runCommand(args, { sessionId: opts.sessionId, timeoutMs: opts.timeoutMs ?? 15_000 });
  return assertOk(result, "screenshot");
}

// ─── Interaction commands ─────────────────────────────────────────────────────

/**
 * Click a ref (headless AX activation by default).
 * @param {string} refId       Qualified ref, e.g. "@s8f3k2p9:e3"
 * @param {string} [snapshotId]  Legacy bare ref requires explicit snapshot ID
 * @param {object} [opts]      { headed?, sessionId? }
 */
async function click(refId, snapshotId, opts = {}) {
  const args = ["click", refId];
  if (snapshotId) args.push("--snapshot", snapshotId);
  const result = await runCommand(args, { headed: opts.headed, sessionId: opts.sessionId });
  return assertOk(result, "click");
}

/**
 * Type text into a ref element.
 */
async function type(refId, text, snapshotId, opts = {}) {
  const args = ["type", refId, text];
  if (snapshotId) args.push("--snapshot", snapshotId);
  const result = await runCommand(args, { sessionId: opts.sessionId });
  return assertOk(result, "type");
}

/**
 * Press a key combo, e.g. "cmd+c", "return", "escape".
 */
async function press(combo, opts = {}) {
  const result = await runCommand(["press", combo], { sessionId: opts.sessionId });
  return assertOk(result, "press");
}

// ─── Mouse commands (require --headed) ───────────────────────────────────────

/**
 * Move cursor to absolute coordinates.
 * @param {number} x
 * @param {number} y
 */
async function mouseMove(x, y, opts = {}) {
  const args = ["mouse-move", "--xy", `${Math.round(x)},${Math.round(y)}`];
  const result = await runCommand(args, { headed: true, sessionId: opts.sessionId });
  return assertOk(result, "mouse-move");
}

/**
 * Click at absolute coordinates.
 * @param {number} x
 * @param {number} y
 * @param {object} [opts]  { button?: "left"|"right"|"middle", count?: number, sessionId? }
 */
async function mouseClick(x, y, opts = {}) {
  const args = [
    "mouse-click",
    "--xy", `${Math.round(x)},${Math.round(y)}`,
  ];
  if (opts.button && opts.button !== "left") args.push("--button", opts.button);
  if (opts.count && opts.count > 1) args.push("--count", String(opts.count));
  const result = await runCommand(args, { headed: true, sessionId: opts.sessionId });
  return assertOk(result, "mouse-click");
}

/**
 * Drag between two refs or coordinate pairs.
 * @param {object} from  { ref? } | { x, y }
 * @param {object} to    { ref? } | { x, y }
 */
async function drag(from, to, opts = {}) {
  const args = ["drag"];
  if (from.ref) args.push("--from", from.ref);
  else args.push("--from-xy", `${Math.round(from.x)},${Math.round(from.y)}`);
  if (to.ref) args.push("--to", to.ref);
  else args.push("--to-xy", `${Math.round(to.x)},${Math.round(to.y)}`);
  const result = await runCommand(args, { headed: true, sessionId: opts.sessionId });
  return assertOk(result, "drag");
}

/**
 * Hover over a ref or coordinates.
 */
async function hover(refOrXy, opts = {}) {
  const args = ["hover"];
  if (typeof refOrXy === "string") args.push(refOrXy);
  else args.push("--xy", `${Math.round(refOrXy.x)},${Math.round(refOrXy.y)}`);
  const result = await runCommand(args, { headed: true, sessionId: opts.sessionId });
  return assertOk(result, "hover");
}

/**
 * Scroll an element.
 * @param {string} refId
 * @param {"up"|"down"|"left"|"right"} direction
 * @param {number} [amount]
 */
async function scroll(refId, direction, amount, snapshotId, opts = {}) {
  const args = ["scroll", refId, "--direction", direction];
  if (amount != null) args.push("--amount", String(amount));
  if (snapshotId) args.push("--snapshot", snapshotId);
  const result = await runCommand(args, { sessionId: opts.sessionId });
  return assertOk(result, "scroll");
}

// ─── Keyboard commands ────────────────────────────────────────────────────────

/**
 * Post a mouse wheel event at coordinates.
 * @param {number} x
 * @param {number} y
 * @param {number} dx  Horizontal delta
 * @param {number} dy  Vertical delta
 */
async function mouseWheel(x, y, dx, dy, opts = {}) {
  const args = [
    "mouse-wheel",
    "--x", String(Math.round(x)),
    "--y", String(Math.round(y)),
    "--dx", String(dx),
    "--dy", String(dy),
  ];
  const result = await runCommand(args, { headed: true, sessionId: opts.sessionId });
  return assertOk(result, "mouse-wheel");
}

// ─── Clipboard commands ───────────────────────────────────────────────────────

/**
 * Read clipboard text content.
 */
async function clipboardGet(opts = {}) {
  const result = await runCommand(["clipboard-get"], { sessionId: opts.sessionId });
  return assertOk(result, "clipboard-get");
}

/**
 * Write text to clipboard.
 * @param {string} text
 */
async function clipboardSet(text, opts = {}) {
  const result = await runCommand(["clipboard-set", text], { sessionId: opts.sessionId });
  return assertOk(result, "clipboard-set");
}

/**
 * Clear the clipboard.
 */
async function clipboardClear(opts = {}) {
  const result = await runCommand(["clipboard-clear"], { sessionId: opts.sessionId });
  return assertOk(result, "clipboard-clear");
}

// ─── Window / app commands ────────────────────────────────────────────────────

/**
 * List visible windows.
 * @param {object} [filter]  { app? }
 */
async function listWindows(filter = {}, opts = {}) {
  const args = ["list-windows"];
  if (filter.app) args.push("--app", filter.app);
  const result = await runCommand(args, { sessionId: opts.sessionId });
  return assertOk(result, "list-windows");
}

/**
 * List running GUI applications.
 * @param {string} [appFilter]  Substring filter
 */
async function listApps(appFilter, opts = {}) {
  const args = ["list-apps"];
  if (appFilter) args.push("--app", appFilter);
  const result = await runCommand(args, { sessionId: opts.sessionId });
  return assertOk(result, "list-apps");
}

/**
 * List connected displays.
 */
async function listDisplays(opts = {}) {
  const result = await runCommand(["list-displays"], { sessionId: opts.sessionId });
  return assertOk(result, "list-displays");
}

/**
 * Focus a window by title, app, or window-id.
 */
async function focusWindow(target, opts = {}) {
  const args = ["focus-window"];
  if (target.app) args.push("--app", target.app);
  if (target.windowId) args.push("--window-id", target.windowId);
  const result = await runCommand(args, { sessionId: opts.sessionId });
  return assertOk(result, "focus-window");
}

/**
 * Launch an application and wait until a window is visible.
 * @param {string} app  App name, bundle ID, or path
 */
async function launch(app, opts = {}) {
  const result = await runCommand(["launch", app], { sessionId: opts.sessionId, timeoutMs: opts.timeoutMs ?? 20_000 });
  return assertOk(result, "launch");
}

/**
 * Close an application.
 * @param {string} app
 * @param {boolean} [force]
 */
async function closeApp(app, force = false, opts = {}) {
  const args = ["close-app", app];
  if (force) args.push("--force");
  const result = await runCommand(args, { sessionId: opts.sessionId });
  return assertOk(result, "close-app");
}

// ─── Wait commands ────────────────────────────────────────────────────────────

/**
 * Wait for a condition.
 * @param {object} condition  { ms?, element?, window?, text?, predicate?, timeout? }
 */
async function wait(condition = {}, opts = {}) {
  const args = ["wait"];
  if (condition.ms != null) args.push(String(condition.ms));
  if (condition.element) {
    args.push("--element", condition.element);
    if (condition.predicate) args.push("--predicate", condition.predicate);
    if (condition.value) args.push("--value", condition.value);
    if (condition.snapshot) args.push("--snapshot", condition.snapshot);
  }
  if (condition.window) args.push("--window", condition.window);
  if (condition.text) {
    args.push("--text", condition.text);
    if (condition.app) args.push("--app", condition.app);
  }
  if (condition.timeout) args.push("--timeout", String(condition.timeout));
  const result = await runCommand(args, { sessionId: opts.sessionId, timeoutMs: (condition.timeout ?? 30_000) + 5_000 });
  return assertOk(result, "wait");
}

// ─── Session management ───────────────────────────────────────────────────────

/**
 * Start a trace-enabled session.
 * @param {string} [name]           Human-readable session name
 * @param {boolean} [screenshots]   Opt in to screenshot replay artifacts
 * @returns {Promise<{session_id: string}>}
 */
async function sessionStart(name, screenshots = false) {
  const args = ["session", "start"];
  if (name) args.push("--name", name);
  if (screenshots) args.push("--screenshots");
  const result = await runCommand(args);
  const data = assertOk(result, "session start");
  return data;
}

/**
 * End (seal) a session.
 * @param {string} sessionId
 */
async function sessionEnd(sessionId) {
  const result = await runCommand(["session", "end", sessionId]);
  return assertOk(result, "session end");
}

/**
 * List sessions.
 */
async function sessionList() {
  const result = await runCommand(["session", "list"]);
  return assertOk(result, "session list");
}

/**
 * GC stale sessions.
 */
async function sessionGc() {
  const result = await runCommand(["session", "gc"]);
  return assertOk(result, "session gc");
}

// ─── Trace commands ───────────────────────────────────────────────────────────

/**
 * Show merged trace for a session.
 * @param {string} sessionId
 * @param {number} [limit]   Max events (0 = all)
 */
async function traceShow(sessionId, limit = 500) {
  const args = ["trace", "show"];
  if (limit != null) args.push("--limit", String(limit));
  const result = await runCommand(args, { sessionId });
  return assertOk(result, "trace show");
}

/**
 * Export trace as self-contained HTML.
 * @param {string} sessionId
 * @param {string} [out]  Output path (defaults to session dir)
 */
async function traceExport(sessionId, out) {
  const args = ["trace", "export"];
  if (out) args.push("--out", out);
  const result = await runCommand(args, { sessionId });
  return assertOk(result, "trace export");
}

// ─── System / status commands ─────────────────────────────────────────────────

/**
 * Adapter status — permissions, snapshot_id, platform, etc.
 */
async function status(opts = {}) {
  const result = await runCommand(["status"], { sessionId: opts.sessionId });
  return assertOk(result, "status");
}

/**
 * Permission report.
 */
async function permissions(opts = {}) {
  const result = await runCommand(["permissions"], { sessionId: opts.sessionId });
  return assertOk(result, "permissions");
}

/**
 * Version information.
 */
async function version() {
  const result = await runCommand(["version"]);
  return assertOk(result, "version");
}

/**
 * Run a bounded sequential JSON batch.
 * @param {object[]} commands  Array of { command, args } objects
 * @param {object} [opts]
 */
async function batch(commands, opts = {}) {
  const json = JSON.stringify(commands);
  const result = await runCommand(["batch", json], {
    sessionId: opts.sessionId,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  return assertOk(result, "batch");
}

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * Check whether the binary is accessible and responds.
 * @returns {Promise<{available: boolean, version?: string, platform?: string, error?: string}>}
 */
async function healthCheck() {
  try {
    const result = await runCommand(["version"], { timeoutMs: 5_000 });
    if (result.ok && result.data) {
      return {
        available: true,
        version: result.data.version,
        platform: result.data.os,
        binaryPath: getBinaryPath(),
      };
    }
    return { available: false, error: result.error?.message ?? "Unknown error" };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Core runner (escape hatch)
  runCommand,
  getBinaryPath,
  healthCheck,

  // Observation
  snapshot,
  find,
  screenshot,

  // Interaction
  click,
  type,
  press,

  // Mouse (--headed)
  mouseMove,
  mouseClick,
  drag,
  hover,
  scroll,
  mouseWheel,

  // Clipboard (works without AX on Windows)
  clipboardGet,
  clipboardSet,
  clipboardClear,

  // Window / App
  listWindows,
  listApps,
  listDisplays,
  focusWindow,
  launch,
  closeApp,

  // Wait
  wait,

  // Session
  sessionStart,
  sessionEnd,
  sessionList,
  sessionGc,

  // Trace
  traceShow,
  traceExport,

  // System
  status,
  permissions,
  version,

  // Batch
  batch,
};
