const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const MAX_EVENTS = 300;
const VALID_LEVELS = new Set(["debug", "info", "warn", "error", "fatal", "system"]);
const VALID_SOURCES = new Set(["local-api", "runner", "stdout", "stderr"]);

let eventSequence = 0;
let automatonEvents = [];
const eventClients = new Set();
let automatonProcess = null;
let automatonState = {
  running: false,
  pid: null,
  startedAt: null,
  lastEventAt: null,
};

function findExecutableOnPath(command) {
  const lookupCommand = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(lookupCommand, [command], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((candidate) => path.resolve(candidate).toLowerCase() !== path.resolve(process.execPath).toLowerCase()) || null;
}

function resolveNodeRuntime() {
  const explicitNode = process.env.REARVY_AUTOMATON_NODE;
  if (explicitNode && fs.existsSync(explicitNode)) {
    return { binary: explicitNode, electronRunAsNode: false };
  }

  if (process.env.REARVY_USE_ELECTRON_NODE_FOR_AUTOMATON === "1") {
    return { binary: process.execPath, electronRunAsNode: true };
  }

  const systemNode = findExecutableOnPath("node");
  if (systemNode) {
    return { binary: systemNode, electronRunAsNode: false };
  }

  return { binary: process.execPath, electronRunAsNode: true };
}

function resolveAutomatonCwd() {
  const envDir = process.env.REARVY_AUTOMATON_DIR;
  const localRepoDir = path.join(__dirname, "..", "..", "automaton");
  const resourcesDir = path.join(process.resourcesPath || "", "automaton");
  const runnerPath = path.join("scripts", "rearvy-runner.js");

  // Preferred order:
  // 1. Explicit env override
  // 2. Local repository `automaton/` (development)
  // 3. Packaged app resourcesPath (production)
  const candidates = [envDir, localRepoDir, resourcesDir].filter(Boolean);

  for (const candidate of candidates) {
    // Ignore common placeholder used in some packaging environments
    if (typeof candidate === "string" && candidate.startsWith("/var/task")) {
      continue;
    }

    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, runnerPath))) {
      return candidate;
    }
  }

  return null;
}

function getLocalApiOrigin(req) {
  const host = req.get("host");
  if (!host) {
    return `http://127.0.0.1:${process.env.REARVY_LOCAL_API_PORT || 4000}`;
  }

  return `http://${host}`;
}

function normalizeLevel(level) {
  return typeof level === "string" && VALID_LEVELS.has(level) ? level : "info";
}

function normalizeSource(source) {
  return typeof source === "string" && VALID_SOURCES.has(source) ? source : "runner";
}

function getLogMessage(log) {
  if (typeof log?.message === "string" && log.message.trim()) {
    return log.message.trim();
  }

  if (typeof log?.error?.message === "string" && log.error.message.trim()) {
    return log.error.message.trim();
  }

  if (typeof log === "string" && log.trim()) {
    return log.trim();
  }

  try {
    return JSON.stringify(log);
  } catch {
    return "Automaton emitted an unreadable log event.";
  }
}

function buildStatus() {
  return {
    available: Boolean(resolveAutomatonCwd()),
    running: automatonState.running,
    pid: automatonState.pid,
    startedAt: automatonState.startedAt,
    lastEventAt: automatonState.lastEventAt,
    events: automatonEvents,
  };
}

function sendSse(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastSse(eventName, payload) {
  for (const client of eventClients) {
    try {
      sendSse(client, eventName, payload);
    } catch {
      eventClients.delete(client);
    }
  }
}

function pushAutomatonEvent(input) {
  const timestamp = new Date().toISOString();
  const event = {
    id: String(++eventSequence),
    timestamp,
    level: normalizeLevel(input.level),
    source: normalizeSource(input.source),
    message: getLogMessage(input.message ?? input.log ?? input),
    module: typeof input.module === "string" && input.module.trim() ? input.module.trim() : undefined,
    pid: typeof input.pid === "number" ? input.pid : automatonState.pid,
  };

  automatonEvents = [...automatonEvents, event].slice(-MAX_EVENTS);
  automatonState.lastEventAt = timestamp;
  broadcastSse("automaton", event);
  broadcastSse("status", buildStatus());

  return event;
}

function handleStatus(_req, res) {
  return res.json(buildStatus());
}

function handleEvents(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  eventClients.add(res);
  sendSse(res, "status", buildStatus());

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
      eventClients.delete(res);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    eventClients.delete(res);
  });
}

function handleAutomatonLog(req, res) {
  const body = req.body || {};
  const log = body.log;

  if (!log) {
    pushAutomatonEvent({
      level: "warn",
      source: "local-api",
      message: "Received Automaton callback without a log payload.",
    });
    return res.status(400).json({ error: "Missing log" });
  }

  const event = pushAutomatonEvent({
    level: log.level,
    source: log.source || body.source || "runner",
    message: log,
    module: log.module,
    pid: automatonState.pid,
  });

  return res.json({ success: true, stored: true, event });
}

async function handleStart(req, res) {
  const { chatId } = req.body || {};
  const userId = req.headers["x-rearvy-user-id"] || "default-user";

  if (automatonState.running && automatonState.pid) {
    pushAutomatonEvent({
      level: "system",
      source: "local-api",
      message: `Automaton is already running with PID ${automatonState.pid}.`,
      pid: automatonState.pid,
    });
    return res.json({ success: true, running: true, alreadyRunning: true, pid: automatonState.pid });
  }

  try {
    console.log(`[Local API] Starting automaton${chatId ? ` for chat ${chatId}` : ""}`);

    const automatonCwd = resolveAutomatonCwd();
    const runnerPath = path.join("scripts", "rearvy-runner.js");

    if (!automatonCwd) {
      console.error("[Local API] Automaton is unavailable: no valid root with runner script was found");
      pushAutomatonEvent({
        level: "error",
        source: "local-api",
        message: "Automaton is not available in this installation. No valid runner script was found.",
      });
      return res.status(501).json({
        error:
          "Automaton is not available in this installation. See AUTO-START-AUTOMATON.md in the app root for troubleshooting.",
        helpDoc: "AUTO-START-AUTOMATON.md",
      });
    }

    const absoluteRunnerPath = path.join(automatonCwd, runnerPath);
    if (!fs.existsSync(absoluteRunnerPath)) {
      console.error(`[Local API] Runner script not found: ${absoluteRunnerPath}`);
      pushAutomatonEvent({
        level: "error",
        source: "local-api",
        message: `Runner script not found at ${absoluteRunnerPath}`,
      });
      return res.status(500).json({ error: `Runner script not found at ${absoluteRunnerPath}` });
    }

    const nodeRuntime = resolveNodeRuntime();
    const childEnv = {
      ...process.env,
      REARVY_USER_ID: userId,
      REARVY_CHAT_ID: chatId || `automaton-${Date.now()}`,
      REARVY_API_URL: getLocalApiOrigin(req),
    };

    if (nodeRuntime.electronRunAsNode) {
      childEnv.ELECTRON_RUN_AS_NODE = "1";
    } else {
      delete childEnv.ELECTRON_RUN_AS_NODE;
    }

    console.log(`[Local API] Spawning automaton from ${automatonCwd} with ${nodeRuntime.binary} (runner: ${absoluteRunnerPath})`);
    pushAutomatonEvent({
      level: "system",
      source: "local-api",
      message: `Spawning Automaton from ${automatonCwd}`,
    });

    const child = spawn(nodeRuntime.binary, [absoluteRunnerPath], {
      cwd: automatonCwd,
      env: childEnv,
      detached: true,
      stdio: "ignore",
      windowsHide: process.platform === "win32",
    });

    automatonProcess = child;
    automatonState = {
      running: true,
      pid: child && child.pid ? child.pid : null,
      startedAt: new Date().toISOString(),
      lastEventAt: automatonState.lastEventAt,
    };

    pushAutomatonEvent({
      level: "system",
      source: "local-api",
      message: automatonState.pid
        ? `Automaton process started with PID ${automatonState.pid}.`
        : "Automaton process started.",
      pid: automatonState.pid,
    });

    child.once("error", (error) => {
      automatonState = {
        running: false,
        pid: null,
        startedAt: automatonState.startedAt,
        lastEventAt: automatonState.lastEventAt,
      };
      automatonProcess = null;
      pushAutomatonEvent({
        level: "error",
        source: "local-api",
        message: `Automaton failed to start: ${error.message}`,
      });
    });

    child.once("exit", (code, signal) => {
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      automatonState = {
        running: false,
        pid: null,
        startedAt: automatonState.startedAt,
        lastEventAt: automatonState.lastEventAt,
      };
      automatonProcess = null;
      pushAutomatonEvent({
        level: code === 0 ? "info" : "error",
        source: "local-api",
        message: `Automaton process stopped with ${reason}.`,
      });
    });

    try {
      if (child && typeof child.unref === "function") child.unref();
    } catch {
      // ignore unref errors
    }

    return res.json({ success: true, running: true, pid: automatonState.pid });
  } catch (error) {
    console.error("[Local API] Error starting automaton:", error);
    pushAutomatonEvent({
      level: "error",
      source: "local-api",
      message: `Error starting Automaton: ${error instanceof Error ? error.message : String(error)}`,
    });
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * Handler for automaton-related local API calls
 */
async function automatonHandler(req, res) {
  // Support a GET to the mount root as a status check so callers that
  // request the mount point without "/status" still receive a useful
  // JSON status response instead of a 404.
  if (req.method === "GET" && (req.path === "/status" || req.path === "/" || req.path === "")) {
    return handleStatus(req, res);
  }

  if (req.method === "GET" && req.path === "/events") {
    return handleEvents(req, res);
  }

  // POST to the mount root remains the automaton log callback
  if (req.method === "POST" && (req.path === "/" || req.path === "")) {
    return handleAutomatonLog(req, res);
  }

  if (req.method === "POST" && req.path === "/start") {
    return handleStart(req, res);
  }

  return res.status(404).json({ error: "Not Found" });
}

module.exports = automatonHandler;
