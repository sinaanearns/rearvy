import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const desktopDir = path.join(rootDir, "desktop-app");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const releaseDir = path.join(rootDir, "desktop-release", stamp);
const builderBin = path.join(
  desktopDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || rootDir,
      env: options.env || process.env,
      shell: options.shell || false,
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

const buildArgs = [
  "--win",
  "nsis",
  "--x64",
  `--config.directories.output=${releaseDir}`,
];

if (!process.env.WIN_CSC_LINK && !process.env.CSC_LINK) {
  console.log("No Windows signing certificate configured; building unsigned and skipping executable signing/editing.");
  buildArgs.push("--config.win.signAndEditExecutable=false");
}

await run(
  builderBin,
  buildArgs,
  {
    cwd: desktopDir,
    env: process.env,
    shell: process.platform === "win32",
  }
);

await run(process.execPath, ["scripts/post-desktop-build.mjs"], {
  cwd: rootDir,
  env: {
    ...process.env,
    DESKTOP_RELEASE_DIR: releaseDir,
  },
});
