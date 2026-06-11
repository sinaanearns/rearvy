const { spawnSync } = require("node:child_process");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(desktopDir, "..");
const requestedArgs = process.argv.slice(2);
const wantsMac = requestedArgs.includes("--mac");
const wantsWin = requestedArgs.includes("--win");
const buildScriptName = wantsMac
  ? "build-mac.mjs"
  : wantsWin
    ? "build-win.mjs"
    : process.platform === "darwin"
      ? "build-mac.mjs"
      : "build-win.mjs";
const buildScript = path.join(rootDir, "scripts", "desktop", buildScriptName);
const forwardedArgs = requestedArgs.filter((arg) => arg !== "--mac" && arg !== "--win");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: options.env || process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

run(process.execPath, [buildScript, ...forwardedArgs]);
