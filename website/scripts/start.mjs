import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, "..");
const standaloneServer = path.join(websiteRoot, ".next", "standalone", "server.js");
const buildIdPath = path.join(websiteRoot, ".next", "BUILD_ID");
const nextBin = path.join(websiteRoot, "node_modules", "next", "dist", "bin", "next");
const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

function startProcess(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: websiteRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("Failed to start production server:", error.message);
    process.exit(1);
  });
}

if (fs.existsSync(standaloneServer)) {
  console.log("Starting Next standalone server...");
  process.env.PORT = port;
  process.env.HOSTNAME = hostname;
  startProcess(process.execPath, [standaloneServer], {
    ELECTRON_RUN_AS_NODE: "1",
    PORT: port,
    HOSTNAME: hostname,
  });
} else if (fs.existsSync(buildIdPath) && fs.existsSync(nextBin)) {
  console.log("Starting Next server from local build output...");
  startProcess(process.execPath, [nextBin, "start", "-p", port], {
    ELECTRON_RUN_AS_NODE: "1",
    PORT: port,
    HOSTNAME: hostname,
  });
} else {
  console.error("No production build found. Run `npm run build` in the website folder first.");
  process.exit(1);
}
