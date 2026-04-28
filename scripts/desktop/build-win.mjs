import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const releaseDir = path.join("desktop-release", stamp);
const builderBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

function run(command, args, env = process.env, shell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      shell,
      stdio: "inherit",
      windowsHide: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

console.log(`Building Windows installer in ${releaseDir}`);

await run(builderBin, [
  "--win",
  "nsis",
  "--x64",
  `--config.directories.output=${releaseDir}`,
], process.env, process.platform === "win32");

await run(process.execPath, ["scripts/desktop/stage-download.mjs"], {
  ...process.env,
  REARVY_DESKTOP_RELEASE_DIR: releaseDir,
});
