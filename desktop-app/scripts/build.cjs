const { spawnSync } = require("node:child_process");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(desktopDir, "..");
const builderCli = require.resolve("electron-builder/out/cli/cli.js");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || desktopDir,
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

run(process.execPath, [builderCli, ...process.argv.slice(2)]);
run(process.execPath, [path.join(rootDir, "scripts", "post-desktop-build.mjs")], {
  cwd: rootDir,
});
