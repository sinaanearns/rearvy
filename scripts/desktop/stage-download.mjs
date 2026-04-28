import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const releaseDir = path.join(rootDir, packageJson.build?.directories?.output || "desktop-release");
const downloadsDir = path.join(rootDir, "public", "downloads");

const productName = packageJson.build?.productName || "Rearvy";
const version = packageJson.version;
const versionedName = `${productName}-${version}-win-x64.exe`;
const stableName = `${productName}-win-x64.exe`;
const expectedInstaller = path.join(releaseDir, versionedName);

function findInstaller() {
  if (existsSync(expectedInstaller)) {
    return expectedInstaller;
  }

  if (!existsSync(releaseDir)) {
    throw new Error(`Release folder not found: ${releaseDir}`);
  }

  const candidate = readdirSync(releaseDir)
    .filter((name) => name.endsWith(".exe"))
    .find((name) => name.startsWith(`${productName}-${version}-win-`));

  if (!candidate) {
    throw new Error(`No Windows installer found in ${releaseDir}`);
  }

  return path.join(releaseDir, candidate);
}

const installerPath = findInstaller();

mkdirSync(downloadsDir, { recursive: true });

copyFileSync(installerPath, path.join(downloadsDir, versionedName));
copyFileSync(installerPath, path.join(downloadsDir, stableName));

writeFileSync(
  path.join(downloadsDir, "latest.json"),
  `${JSON.stringify(
    {
      platform: "windows",
      version,
      file: stableName,
      versionedFile: versionedName,
      generatedAt: new Date().toISOString(),
    },
    null,
    2
  )}\n`
);

console.log(`Staged ${stableName} in public/downloads`);
