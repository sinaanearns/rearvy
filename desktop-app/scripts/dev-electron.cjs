const { spawn, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const electronPath = require("electron");
const { createLogger } = require("../lib/logger.cjs");
const { getPortOwnerPids } = require("../lib/port-owner.cjs");

const log = createLogger("DevElectron");

const env = { ...process.env };
loadRootEnvLocal(env);
loadDesktopEnvLocal(env);
delete env.ELECTRON_RUN_AS_NODE;

async function cleanupStalePortProcesses() {
  const port = Number(env.REARVY_LOCAL_API_PORT || 4000);
  try {
    const pids = await getPortOwnerPids(port);
    for (const pidStr of pids) {
      const pid = Number(pidStr);
      if (pid && pid !== process.pid) {
        log.info(`Cleaning up stale process on port ${port} (PID ${pid})...`);
        try {
          if (process.platform === "win32") {
            execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          } else {
            execSync(`kill -9 ${pid}`, { stdio: "ignore" });
          }
        } catch (killError) {
          // ignore expected kill failure
        }
      }
    }
  } catch (error) {
    // ignore
  }
}

(async () => {
  await cleanupStalePortProcesses();

  const child = spawn(electronPath, ["."], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    log.error("Failed to launch Electron:", error);
    process.exit(1);
  });
})();

function loadRootEnvLocal(targetEnv) {
  const envPath = path.resolve(process.cwd(), "..", ".env.local");
  loadEnvFile(envPath, targetEnv);
}

function loadDesktopEnvLocal(targetEnv) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  loadEnvFile(envPath, targetEnv);
}

function loadEnvFile(envPath, targetEnv) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(targetEnv, key)) {
      continue;
    }

    targetEnv[key] = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
