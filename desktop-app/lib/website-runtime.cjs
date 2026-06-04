const path = require("node:path");
const fs = require("fs/promises");
const net = require("node:net");
const { spawn } = require("child_process");
const { createLogger } = require("./logger.cjs");
const { getPortKillCommand, getPortOwnerSummary } = require("./port-owner.cjs");

const log = createLogger("");
const waitLog = createLogger("waitForUrl");
let websiteRuntimeChild = null;

function ignoreExpectedRuntimeProbeError(error) {
  void error;
}

function writeWebsiteStartLog(userDataPath, summary) {
  try {
    const logPath = path.join(userDataPath, "website-start.log");
    void fs.writeFile(logPath, summary).catch((error) => {
      log.debug("[Rearvy] Could not write website startup log:", error?.message || error);
    });
    return logPath;
  } catch (error) {
    log.debug("[Rearvy] Could not resolve website startup log path:", error?.message || error);
    return null;
  }
}

function waitForUrl(url, timeout = 30000, interval = 500) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const httpMod = parsed.protocol === "https:" ? require("https") : require("http");
    const port = parsed.port || (parsed.protocol === "https:" ? 443 : 80);
    const hostname = parsed.hostname;
    const requestPath = parsed.pathname || "/";
    const start = Date.now();

    waitLog.debug(
      `Starting with hostname=${hostname}, port=${port}, path=${requestPath}, timeout=${timeout}ms, interval=${interval}ms`
    );

    function tryOnce() {
      const elapsed = Date.now() - start;
      waitLog.debug(`Attempt at ${elapsed}ms`);

      const req = httpMod.request(
        { method: "HEAD", hostname, port, path: requestPath, timeout: 3000 },
        (res) => {
          waitLog.debug(`Got response with status ${res.statusCode}`);
          res.resume();
          resolve(true);
        }
      );

      req.on("error", (err) => {
        waitLog.debug(`Error: ${err.message}`);
        if (Date.now() - start >= timeout) {
          waitLog.debug(`Timeout exceeded after ${Date.now() - start}ms`);
          resolve(false);
          return;
        }

        waitLog.debug(`Retrying after ${interval}ms...`);
        setTimeout(tryOnce, interval);
      });

      req.on("timeout", () => {
        waitLog.debug("Request timeout, destroying and retrying...");
        req.destroy();
        if (Date.now() - start >= timeout) {
          waitLog.debug("Overall timeout exceeded");
          resolve(false);
          return;
        }

        waitLog.debug(`Retrying after ${interval}ms...`);
        setTimeout(tryOnce, interval);
      });

      req.end();
    }

    tryOnce();
  });
}

function getNpmRunCommand(scriptName) {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      commandArgs: ["/d", "/s", "/c", "npm", "run", scriptName],
    };
  }

  return {
    command: "npm",
    commandArgs: ["run", scriptName],
  };
}

function normalizeRoutePath(routePath) {
  const trimmed = typeof routePath === "string" ? routePath.trim() : "";
  if (!trimmed) {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function getConfiguredDevUrl() {
  const startPath = normalizeRoutePath(process.env.REARVY_DESKTOP_START_PATH || "/chat/new");
  const fallbackUrl = `http://localhost:3000${startPath}`;

  for (const candidate of [process.env.REARVY_DESKTOP_DEV_URL, fallbackUrl]) {
    if (!candidate) {
      continue;
    }

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch (error) {
      ignoreExpectedRuntimeProbeError(error);
      // Ignore invalid configured URLs and continue to the fallback.
    }
  }

  return fallbackUrl;
}

function isLoopbackDevUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1")
    );
  } catch (error) {
    ignoreExpectedRuntimeProbeError(error);
    return false;
  }
}

function getPortFromUrl(value, fallbackPort = 3000) {
  try {
    const parsed = new URL(value);
    const parsedPort = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
    return Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : fallbackPort;
  } catch (error) {
    ignoreExpectedRuntimeProbeError(error);
    return fallbackPort;
  }
}

function withPort(value, port) {
  const parsed = new URL(value);
  parsed.port = String(port);
  return parsed.toString();
}

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

async function findAvailablePort(startPort, maxAttempts = 25) {
  const firstPort = Math.max(1, Number(startPort) || 3000);

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = firstPort + offset;
    if (await canListenOnPort(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No available local web port found from ${firstPort} to ${firstPort + maxAttempts - 1}`);
}

async function startLocalWebsiteRuntime({
  autoStartWebsite,
  defaultPackagedAppUrl,
  defaultPackagedWebPort,
  isPackaged,
  projectRoot,
  userDataPath,
  websiteRoot,
}) {
  if (!autoStartWebsite) {
    log.info("[Rearvy] Desktop configured to NOT auto-start website runtime (REARVY_DESKTOP_AUTO_START_WEBSITE=0)");
    return false;
  }

  const productionBuildId = path.join(websiteRoot, ".next", "BUILD_ID");
  const standaloneServerCandidates = [
    path.join(websiteRoot, ".next", "standalone", "server.js"),
    path.join(websiteRoot, ".next", "standalone", "website", "server.js"),
  ];

  let command;
  let commandArgs;
  let cwd;
  let envOverrides = {};

  if (!isPackaged) {
    const configuredDevUrl = getConfiguredDevUrl();

    if (isLoopbackDevUrl(configuredDevUrl) && await waitForUrl(configuredDevUrl, 1000, 250)) {
      process.env.REARVY_DESKTOP_DEV_URL = configuredDevUrl;
      log.info(`[Rearvy] Reusing already-running website dev server: ${configuredDevUrl}`);
      return true;
    }

    if (isLoopbackDevUrl(configuredDevUrl)) {
      const preferredPort = getPortFromUrl(configuredDevUrl, 3000);
      const selectedPort = await findAvailablePort(preferredPort);

      if (selectedPort !== preferredPort) {
        const selectedDevUrl = withPort(configuredDevUrl, selectedPort);
        const ownerSummary = await getPortOwnerSummary(preferredPort);
        const killCommand = await getPortKillCommand(preferredPort);
        process.env.REARVY_DESKTOP_DEV_URL = selectedDevUrl;
        envOverrides = {
          ...envOverrides,
          PORT: String(selectedPort),
        };
        log.warn(
          `[Rearvy] Website dev port ${preferredPort} is occupied${ownerSummary ? ` by ${ownerSummary}` : ""} but not responding; starting Next on ${selectedPort}.${killCommand ? ` Kill it with: ${killCommand}` : ""}`
        );
      } else {
        process.env.REARVY_DESKTOP_DEV_URL = configuredDevUrl;
      }
    }

    const npmRun = getNpmRunCommand("dev:web");
    command = npmRun.command;
    commandArgs = npmRun.commandArgs;
    cwd = projectRoot;
    log.info("[Rearvy] Desktop dev mode detected, starting website dev server with npm run dev:web...");
    log.info(`[Rearvy] Working directory: ${cwd}`);
    log.info(`[Rearvy] Command: ${command} ${commandArgs.join(" ")}`);
  } else {
    try {
      const productionStandaloneServer = await findExistingPath(standaloneServerCandidates);
      await fs.access(productionStandaloneServer);
      command = process.execPath;
      commandArgs = [productionStandaloneServer];
      cwd = path.dirname(productionStandaloneServer);
      envOverrides = {
        PORT: String(defaultPackagedWebPort),
        HOSTNAME: "127.0.0.1",
      };
      process.env.REARVY_DESKTOP_APP_URL = defaultPackagedAppUrl;
      log.info("[Rearvy] Starting packaged website runtime with Next standalone server...");
      log.info(`[Rearvy] Server path: ${productionStandaloneServer}`);
    } catch (error) {
      ignoreExpectedRuntimeProbeError(error);
      try {
        await fs.access(productionBuildId);
        const nextBin = path.join(websiteRoot, "node_modules", "next", "dist", "bin", "next");
        command = process.execPath;
        commandArgs = [nextBin, "start", "-p", String(defaultPackagedWebPort)];
        cwd = websiteRoot;
        process.env.REARVY_DESKTOP_APP_URL = defaultPackagedAppUrl;
        log.info("[Rearvy] Starting packaged website runtime with local Next server...");
        log.info(`[Rearvy] Website root: ${websiteRoot}`);
      } catch (buildError) {
        ignoreExpectedRuntimeProbeError(buildError);
        log.error("[Rearvy] Packaged website runtime not found under:", websiteRoot);
        log.error("[Rearvy] Searched for:");
        for (const candidate of standaloneServerCandidates) {
          log.error(`  - ${candidate}`);
        }
        log.error(`  - Next build (BUILD_ID at ${productionBuildId})`);
        const remoteFallback =
          process.env.REARVY_DESKTOP_REMOTE_FALLBACK_URL ||
          process.env.REARVY_REMOTE_APP_URL ||
          "https://www.rearvy.com";
        process.env.REARVY_DESKTOP_APP_URL = remoteFallback;
        log.warn(`[Rearvy] No packaged website runtime found; falling back to ${remoteFallback}`);
        return false;
      }
    }
  }

  try {
    log.info(`[Rearvy] Spawning website runtime: ${command} ${commandArgs.join(" ")}`);
    const attachToTerminal = !isPackaged;
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: attachToTerminal ? "inherit" : ["ignore", "pipe", "pipe"],
      shell: false,
      detached: !attachToTerminal,
      env:
        command === process.execPath
          ? {
              ...process.env,
              ELECTRON_RUN_AS_NODE: "1",
              ...envOverrides,
            }
          : {
              ...process.env,
              ...envOverrides,
            },
      windowsHide: false,
    });

    websiteRuntimeChild = child;

    let stderrCaptured = "";
    let stdoutCaptured = "";
    const captureTimeout = attachToTerminal ? null : setTimeout(() => {
      if (stderrCaptured.includes("error") || stderrCaptured.includes("Error")) {
        log.error("[Rearvy] Website server startup error:", stderrCaptured.substring(0, 500));
      }
      if (stdoutCaptured.includes("port") || stdoutCaptured.includes("listening") || stdoutCaptured.includes("ready")) {
        log.info("[Rearvy] Website server started:", stdoutCaptured.substring(0, 500));
      }
    }, 2000);

    if (attachToTerminal) {
      log.info("[Rearvy] Website dev server output is attached to this terminal.");
    } else {
      child.stderr.on("data", (data) => {
        const text = data.toString();
        stderrCaptured += text;
        log.debug("[Rearvy:WebServer:stderr]", text);
      });

      child.stdout.on("data", (data) => {
        const text = data.toString();
        stdoutCaptured += text;
        log.debug("[Rearvy:WebServer:stdout]", text);
      });
    }

    child.on("error", (err) => {
      log.error("[Rearvy] Failed to spawn website runtime:", err.message);
      const summary = `Failed to spawn website runtime: ${err?.message || String(err)}\n\nSTDOUT:\n${stdoutCaptured}\n\nSTDERR:\n${stderrCaptured}`;
      const logPath = writeWebsiteStartLog(userDataPath, summary);
      if (logPath) {
        log.error(`[Rearvy] Wrote website startup failure log to ${logPath}`);
      }

      if (captureTimeout) {
        clearTimeout(captureTimeout);
      }
    });

    child.on("close", (code, signal) => {
      if (websiteRuntimeChild === child) {
        websiteRuntimeChild = null;
      }

      if (captureTimeout) {
        clearTimeout(captureTimeout);
      }

      const summary = `Website runtime exited. code=${code} signal=${signal}\n\nSTDOUT:\n${stdoutCaptured}\n\nSTDERR:\n${stderrCaptured}`;
      const logPath = writeWebsiteStartLog(userDataPath, summary);
      if (logPath) {
        log.info(`[Rearvy] Website runtime exit info written to ${logPath}`);
      }
    });

    if (!attachToTerminal) {
      child.unref();
    }

    const initial = `Website runtime started (spawned). CMD: ${command} ${commandArgs.join(" ")}\n\nSTDOUT (initial):\n${stdoutCaptured}\n\nSTDERR (initial):\n${stderrCaptured}`;
    writeWebsiteStartLog(userDataPath, initial);

    return true;
  } catch (error) {
    log.error("Failed to start website runtime:", error);
    return false;
  }
}

function stopLocalWebsiteRuntime() {
  const child = websiteRuntimeChild;
  if (!child) {
    return;
  }

  websiteRuntimeChild = null;

  if (child.killed || child.exitCode !== null) {
    return;
  }

  try {
    child.kill();
  } catch (error) {
    log.debug("[Rearvy] Ignored website runtime shutdown error:", error?.message || error);
    // Ignore shutdown errors.
  }
}

async function findExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (error) {
      ignoreExpectedRuntimeProbeError(error);
      // Try the next candidate.
    }
  }

  return candidates[0];
}

module.exports = {
  startLocalWebsiteRuntime,
  stopLocalWebsiteRuntime,
  waitForUrl,
};
