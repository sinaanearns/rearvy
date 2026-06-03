import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, "..");
const standaloneServer = path.join(websiteRoot, ".next", "standalone", "server.js");
const buildIdPath = path.join(websiteRoot, ".next", "BUILD_ID");
const buildManifestPath = path.join(websiteRoot, ".next", "build-manifest.json");
const routesManifestPath = path.join(websiteRoot, ".next", "routes-manifest.json");
const prerenderManifestPath = path.join(websiteRoot, ".next", "prerender-manifest.json");
const nextBin = path.join(websiteRoot, "node_modules", "next", "dist", "bin", "next");

function getArgValue(...names) {
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    const inlineName = names.find((name) => arg.startsWith(`${name}=`));
    if (inlineName) {
      return arg.slice(inlineName.length + 1);
    }

    if (names.includes(arg)) {
      return process.argv[index + 1];
    }
  }

  return undefined;
}

const port = getArgValue("-p", "--port") || process.env.PORT || "3000";
const hostname = getArgValue("-H", "--hostname") || process.env.HOSTNAME || "0.0.0.0";

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForLocalBuildOutput() {
  const deadline = Date.now() + 30_000;

  while (
    (!fs.existsSync(routesManifestPath) || !fs.existsSync(prerenderManifestPath)) &&
    Date.now() < deadline
  ) {
    sleep(250);
  }
}

function restoreMissingBuildId() {
  if (fs.existsSync(buildIdPath) || !fs.existsSync(buildManifestPath)) {
    return;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf8"));
    const files = [
      ...Object.values(manifest.pages || {}).flat(),
      ...(manifest.lowPriorityFiles || []),
      ...(manifest.rootMainFiles || []),
      ...(manifest.polyfillFiles || []),
    ];

    const buildFile = files.find(
      (file) =>
        typeof file === "string" &&
        /^static\/[^/]+\/_(?:build|ssg|clientMiddleware)Manifest\.js$/.test(file)
    );
    const buildId = buildFile?.split("/")[1];

    if (buildId) {
      fs.writeFileSync(buildIdPath, buildId);
      console.log(`Restored missing Next BUILD_ID from build manifest: ${buildId}`);
    }
  } catch (error) {
    console.warn(
      "Could not restore missing Next BUILD_ID:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

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
} else if (fs.existsSync(nextBin)) {
  waitForLocalBuildOutput();
  restoreMissingBuildId();
  if (
    !fs.existsSync(buildIdPath) ||
    !fs.existsSync(routesManifestPath) ||
    !fs.existsSync(prerenderManifestPath)
  ) {
    console.error("No production build found. Run `npm run build` in the website folder first.");
    process.exit(1);
  }

  console.log("Starting Next server from local build output...");
  startProcess(process.execPath, [nextBin, "start", "-p", port, "-H", hostname], {
    ELECTRON_RUN_AS_NODE: "1",
    PORT: port,
    HOSTNAME: hostname,
  });
} else {
  console.error("No production build found. Run `npm run build` in the website folder first.");
  process.exit(1);
}
