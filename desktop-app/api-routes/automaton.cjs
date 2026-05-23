const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let lastWebsiteOrigin = null;

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
    if (typeof candidate === 'string' && candidate.startsWith('/var/task')) {
      continue;
    }

    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, runnerPath))) {
      return candidate;
    }
  }

  return null;
}

function parseHttpOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

function getLocalApiOrigin(req) {
  const host = req.get("host");
  if (!host) {
    return `http://127.0.0.1:${process.env.REARVY_LOCAL_API_PORT || 4000}`;
  }

  return `http://${host}`;
}

function getRequestWebsiteOrigin(req) {
  const origin = parseHttpOrigin(req.get("origin"));
  if (origin) {
    return origin;
  }

  const referer = parseHttpOrigin(req.get("referer"));
  if (referer) {
    return referer;
  }

  return null;
}

function resolveAutomatonCallbackUrl() {
  const explicitCallback = process.env.REARVY_AUTOMATON_CALLBACK_URL;
  if (explicitCallback) {
    try {
      const parsed = new URL(explicitCallback);
      if (parsed.pathname === "/" || parsed.pathname === "") {
        return new URL("/api/internal/automaton", parsed.origin).toString();
      }
      return parsed.toString();
    } catch {
      console.warn("[Local API] Ignoring invalid REARVY_AUTOMATON_CALLBACK_URL:", explicitCallback);
    }
  }

  const candidateOrigins = [
    lastWebsiteOrigin,
    process.env.REARVY_DESKTOP_DEV_URL,
    process.env.REARVY_DESKTOP_APP_URL,
    process.env.REARVY_REMOTE_APP_URL,
    "http://localhost:3000",
  ];

  for (const candidate of candidateOrigins) {
    const origin = parseHttpOrigin(candidate);
    if (origin) {
      return new URL("/api/internal/automaton", origin).toString();
    }
  }

  return "http://localhost:3000/api/internal/automaton";
}

async function relayAutomatonLog(req, res) {
  const body = req.body || {};
  const log = body.log;
  const chatId = body.chatId;
  const userId = body.userId || req.headers["x-rearvy-user-id"] || "default-user";

  if (!chatId || !log) {
    return res.status(400).json({ error: "Missing chatId or log" });
  }

  const targetUrl = resolveAutomatonCallbackUrl();

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rearvy-desktop": "1",
      },
      body: JSON.stringify({
        userId,
        chatId,
        log,
      }),
    });

    const responseText = await response.text();
    let payload = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { text: responseText };
      }
    }

    if (!response.ok) {
      console.error(`[Local API] Automaton log relay failed: ${response.status}`, payload);
      return res.status(502).json({
        error: "Automaton log relay failed",
        status: response.status,
        detail: payload,
      });
    }

    return res.json({ success: true, relayed: true, target: targetUrl, response: payload });
  } catch (error) {
    console.error("[Local API] Automaton log relay error:", error);
    return res.status(502).json({
      error: "Automaton log relay failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handler for automaton-related local API calls
 */
async function automatonHandler(req, res) {
  const { chatId } = req.body || {};
  const userId = req.headers['x-rearvy-user-id'] || 'default-user';

  if (req.path === '/' || req.path === '') {
    return relayAutomatonLog(req, res);
  }

  if (req.path === '/start') {
    try {
      console.log(`[Local API] Starting automaton for chat ${chatId}`);
      lastWebsiteOrigin = getRequestWebsiteOrigin(req) || lastWebsiteOrigin;

      const automatonCwd = resolveAutomatonCwd();
      const runnerPath = path.join("scripts", "rearvy-runner.js");

      if (!automatonCwd) {
        console.error("[Local API] Automaton is unavailable: no valid root with runner script was found");
        return res.status(501).json({
          error:
            "Automaton is not available in this installation. See AUTO-START-AUTOMATON.md in the app root for troubleshooting.",
          helpDoc: "AUTO-START-AUTOMATON.md",
        });
      }

      const absoluteRunnerPath = path.join(automatonCwd, runnerPath);
      if (!fs.existsSync(absoluteRunnerPath)) {
        console.error(`[Local API] Runner script not found: ${absoluteRunnerPath}`);
        return res.status(500).json({ error: `Runner script not found at ${absoluteRunnerPath}` });
      }

      const env = {
        ...process.env,
        REARVY_USER_ID: userId,
        REARVY_CHAT_ID: chatId,
        REARVY_API_URL: getLocalApiOrigin(req),
      };

      const nodeBinary = process.execPath;

      console.log(`[Local API] Spawning automaton from ${automatonCwd} (runner: ${absoluteRunnerPath})`);

      const child = spawn(nodeBinary, [absoluteRunnerPath], {
        cwd: automatonCwd,
        env: {
          ...env,
          ELECTRON_RUN_AS_NODE: "1",
        },
        detached: true,
        stdio: 'ignore',
      });

      // If spawn succeeded, detach so it survives as background process
      try {
        if (child && typeof child.unref === 'function') child.unref();
      } catch (e) {
        // ignore unref errors
      }

      return res.json({ success: true, pid: child && child.pid ? child.pid : null });
    } catch (error) {
      console.error('[Local API] Error starting automaton:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Handle other automaton routes if needed
  res.status(404).json({ error: 'Not Found' });
}

module.exports = automatonHandler;
