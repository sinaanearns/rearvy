const path = require("node:path");
const fs = require("fs/promises");
const { spawn } = require("child_process");
const { createLogger } = require("./logger.cjs");

const log = createLogger("");
const waitLog = createLogger("waitForUrl");

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
    } catch {
      try {
        await fs.access(productionBuildId);
        const nextBin = path.join(websiteRoot, "node_modules", "next", "dist", "bin", "next");
        command = process.execPath;
        commandArgs = [nextBin, "start", "-p", String(defaultPackagedWebPort)];
        cwd = websiteRoot;
        process.env.REARVY_DESKTOP_APP_URL = defaultPackagedAppUrl;
        log.info("[Rearvy] Starting packaged website runtime with local Next server...");
        log.info(`[Rearvy] Website root: ${websiteRoot}`);
      } catch {
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
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      detached: true,
      env:
        command === process.execPath
          ? {
              ...process.env,
              ELECTRON_RUN_AS_NODE: "1",
              ...envOverrides,
            }
          : process.env,
    });

    let stderrCaptured = "";
    let stdoutCaptured = "";
    const captureTimeout = setTimeout(() => {
      if (stderrCaptured.includes("error") || stderrCaptured.includes("Error")) {
        log.error("[Rearvy] Website server startup error:", stderrCaptured.substring(0, 500));
      }
      if (stdoutCaptured.includes("port") || stdoutCaptured.includes("listening") || stdoutCaptured.includes("ready")) {
        log.info("[Rearvy] Website server started:", stdoutCaptured.substring(0, 500));
      }
    }, 2000);

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

    child.on("error", (err) => {
      log.error("[Rearvy] Failed to spawn website runtime:", err.message);
      try {
        const logPath = path.join(userDataPath, "website-start.log");
        const summary = `Failed to spawn website runtime: ${err?.message || String(err)}\n\nSTDOUT:\n${stdoutCaptured}\n\nSTDERR:\n${stderrCaptured}`;
        fs.writeFile(logPath, summary).catch(() => {});
        log.error(`[Rearvy] Wrote website startup failure log to ${logPath}`);
      } catch {
        // Ignore file-write errors.
      }

      clearTimeout(captureTimeout);
    });

    child.on("exit", (code, signal) => {
      try {
        const logPath = path.join(userDataPath, "website-start.log");
        const summary = `Website runtime exited. code=${code} signal=${signal}\n\nSTDOUT:\n${stdoutCaptured}\n\nSTDERR:\n${stderrCaptured}`;
        fs.writeFile(logPath, summary).catch(() => {});
        log.info(`[Rearvy] Website runtime exit info written to ${logPath}`);
      } catch {
        // Ignore file-write errors.
      }
    });

    child.unref();
    clearTimeout(captureTimeout);
    try {
      const logPath = path.join(userDataPath, "website-start.log");
      const initial = `Website runtime started (spawned). CMD: ${command} ${commandArgs.join(" ")}\n\nSTDOUT (initial):\n${stdoutCaptured}\n\nSTDERR (initial):\n${stderrCaptured}`;
      fs.writeFile(logPath, initial).catch(() => {});
    } catch {
      // Ignore file-write errors.
    }

    return true;
  } catch (error) {
    log.error("Failed to start website runtime:", error);
    return false;
  }
}

async function findExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return candidates[0];
}

module.exports = {
  startLocalWebsiteRuntime,
  waitForUrl,
};
