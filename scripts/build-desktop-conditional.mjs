import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronBuilderBin = path.join(
  rootDir,
  "desktop-app",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

if (process.env.VERCEL || process.env.CF_PAGES || !fs.existsSync(electronBuilderBin)) {
  console.log("Skipping desktop build on web deploy or missing desktop dependencies");
  process.exit(0);
}

const npmCommand = process.env.npm_execpath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const npmArgsPrefix = process.env.npm_execpath ? [process.env.npm_execpath] : [];
const result = spawnSync(npmCommand, [...npmArgsPrefix, "run", "desktop:build:win"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`npm run desktop:build:win exited with code ${result.status}`);
}
