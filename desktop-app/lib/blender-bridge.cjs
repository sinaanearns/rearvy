const path = require("node:path");
const fs = require("fs/promises");
const fsSync = require("fs");
const { execSync, spawn } = require("child_process");
const { createLogger } = require("./logger.cjs");

const log = createLogger("");

let blenderMcpProcess = null;
let blenderAddonWarningShown = false;
let blenderBridgePortWarningShown = false;

function ignoreExpectedBlenderLookupError(error) {
  void error;
}

async function autoLaunchBlender() {
  log.info("[Rearvy] Checking if Blender is running...");

  try {
    const tasklist = execSync("tasklist", { encoding: "utf8" });
    if (tasklist.includes("blender.exe")) {
      log.info("[Rearvy] Blender is already running");
      return { launched: false, success: true };
    }
  } catch (error) {
    log.warn("[Rearvy] Could not check running processes:", error.message);
  }

  const blenderPaths = [
    "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
    "C:\\Program Files (x86)\\Blender Foundation\\Blender 4.2\\blender.exe",
    path.join(process.env.USERPROFILE || "", "AppData\\Local\\Programs\\Blender Foundation\\Blender 4.2\\blender.exe"),
  ];

  for (const blenderPath of blenderPaths) {
    try {
      await fs.access(blenderPath);
      log.info(`[Rearvy] Launching Blender from: ${blenderPath}`);

      const child = spawn(blenderPath, [], {
        stdio: "ignore",
        detached: true,
        windowsHide: true,
      });
      child.unref();

      await new Promise((resolve) => setTimeout(resolve, 2000));
      log.info("[Rearvy] Blender launched successfully");
      return { launched: true, success: true };
    } catch (error) {
      ignoreExpectedBlenderLookupError(error);
      // Continue to the next known installation path.
    }
  }

  log.warn("[Rearvy] Could not auto-launch Blender. Please open Blender manually.");
  return { launched: false, success: false };
}

function startBlenderMcpBridge({ dialog, projectRoot }) {
  if (blenderMcpProcess) {
    log.info("[Rearvy] Blender MCP bridge already started");
    return;
  }

  log.info("[Rearvy] Starting Blender MCP bridge...");

  const bridgeScript = path.join(projectRoot, "scripts", "blender-mcp-bridge.mjs");

  log.info(`[Rearvy] Bridge script path: ${bridgeScript}`);
  log.info(`[Rearvy] Project root: ${projectRoot}`);

  const bridgeEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PATH: process.env.PATH,
    PYTHONPATH: process.env.PYTHONPATH || "",
    BLENDER_MCP_CMD: process.env.BLENDER_MCP_CMD,
    BLENDER_MCP_URL: process.env.BLENDER_MCP_URL,
    BLENDER_EXECUTABLE: process.env.BLENDER_EXECUTABLE,
  };

  if (!bridgeEnv.BLENDER_EXECUTABLE) {
    try {
      const finder = process.platform === "win32" ? "where blender" : "which blender";
      const out = execSync(finder, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .split(/\r?\n/)
        .find(Boolean);
      if (out) {
        bridgeEnv.BLENDER_EXECUTABLE = out.trim();
      }
    } catch (error) {
      ignoreExpectedBlenderLookupError(error);
      // Blender is not on PATH.
    }

    if (!bridgeEnv.BLENDER_EXECUTABLE && process.platform === "win32") {
      const candidates = [
        "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
        "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
        path.join(process.env.USERPROFILE || "", "AppData\\Local\\Programs\\Blender Foundation\\Blender 4.2\\blender.exe"),
      ];
      for (const candidate of candidates) {
        try {
          if (fsSync.existsSync(candidate)) {
            bridgeEnv.BLENDER_EXECUTABLE = candidate;
            break;
          }
        } catch (error) {
          ignoreExpectedBlenderLookupError(error);
          // Continue to the next candidate.
        }
      }
    }
  }

  log.info(`[Rearvy] Bridge env - BLENDER_MCP_CMD: ${bridgeEnv.BLENDER_MCP_CMD || "(not set)"}`);
  log.info(`[Rearvy] Bridge env - BLENDER_MCP_URL: ${bridgeEnv.BLENDER_MCP_URL || "(not set)"}`);
  log.info(`[Rearvy] Bridge env - BLENDER_EXECUTABLE: ${bridgeEnv.BLENDER_EXECUTABLE || "(not set)"}`);

  log.info("[Rearvy] Spawning bridge process...");
  try {
    blenderMcpProcess = spawn(process.execPath, [bridgeScript, "--port", "3002"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: bridgeEnv,
      windowsHide: true,
    });
    log.info("[Rearvy] Bridge process spawned successfully");
  } catch (error) {
    log.error("[Rearvy] Failed to spawn bridge process:", error);
    blenderMcpProcess = null;
    return;
  }

  blenderMcpProcess.stdout?.on("data", (data) => {
    log.debug(`[Blender MCP] ${data.toString().trim()}`);
  });

  blenderMcpProcess.stderr?.on("data", (data) => {
    const message = data.toString().trim();
    log.error(`[Blender MCP Error] ${message}`);

    const addonNotRunning =
      message.includes("Could not connect to Blender") ||
      message.includes("Make sure the Blender addon is running") ||
      message.includes("Failed to connect to Blender") ||
      message.includes("WinError 10061");

    if (addonNotRunning && !blenderAddonWarningShown) {
      blenderAddonWarningShown = true;
      dialog.showMessageBox({
        type: "warning",
        title: "Blender Connection Required",
        message: "Rearvy can reach Blender MCP, but Blender is not connected.",
        detail:
          "To edit 3D objects:\n" +
          "1. Open Blender\n" +
          "2. Enable the Blender MCP add-on (Edit -> Preferences -> Add-ons -> Search 'MCP')\n" +
          "3. Restart Blender\n\n" +
          "Then retry your request in chat (for example: 'create a ball' or 'edit selected object').",
        buttons: ["OK"],
      });
    }

    const mcpNotFound =
      message.includes("Could not start blender-mcp") ||
      message.includes("All blender-mcp command candidates failed") ||
      message.includes("ENOENT") ||
      message.includes("not found") ||
      message.includes("not recognized");

    if (mcpNotFound && !blenderAddonWarningShown) {
      blenderAddonWarningShown = true;
      dialog.showMessageBox({
        type: "warning",
        title: "Blender MCP Not Found",
        message: "The Blender MCP server is not installed or not in PATH.",
        detail:
          "Install blender-mcp using one of:\n" +
          "  - pip install blender-mcp\n" +
          "  - Or set BLENDER_MCP_CMD environment variable\n\n" +
          "Then restart Rearvy Desktop.",
        buttons: ["OK"],
      });
    }

    const bridgePortInUse = message.includes("EADDRINUSE") || message.includes("address already in use");

    if (bridgePortInUse && !blenderBridgePortWarningShown) {
      blenderBridgePortWarningShown = true;
      dialog.showMessageBox({
        type: "warning",
        title: "Blender Bridge Port Busy",
        message: "Port 3002 is already in use, so the Blender bridge cannot start.",
        detail:
          "Close previous Rearvy/Electron/Node processes, then relaunch desktop mode.\n\n" +
          "On Windows you can use desktop-dev.bat from the project root to clean stale processes and restart.",
        buttons: ["OK"],
      });
    }
  });

  blenderMcpProcess.on("error", (error) => {
    log.error("[Blender MCP] Failed to start:", error);
    blenderMcpProcess = null;
  });

  blenderMcpProcess.on("exit", (code, signal) => {
    log.info(`[Blender MCP] Exited with code ${code}, signal ${signal}`);
    blenderMcpProcess = null;
  });

  log.info("[Rearvy] Bridge event listeners set up successfully");
}

function stopBlenderMcpBridge() {
  if (!blenderMcpProcess) {
    return;
  }

  log.info("[Rearvy] Stopping Blender MCP bridge...");
  blenderMcpProcess.kill();
  blenderMcpProcess = null;
}

module.exports = {
  autoLaunchBlender,
  startBlenderMcpBridge,
  stopBlenderMcpBridge,
};
