import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const desktopPackageJson = JSON.parse(
  await readFile(path.join(rootDir, "desktop-app", "package.json"), "utf8")
);
const rootPackageJson = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const releaseDir = path.resolve(
  rootDir,
  process.env.REARVY_DESKTOP_RELEASE_DIR || process.env.DESKTOP_RELEASE_DIR || "desktop-release"
);
const downloadTargets = [
  path.join(rootDir, "website", "public", "downloads"),
  path.join(rootDir, "public", "downloads"),
];

const productName = desktopPackageJson.build?.productName || "Rearvy";
const version = desktopPackageJson.version || rootPackageJson.version;
const stableName = `${productName}UserSetup-x64.exe`;
const versionedName = `${productName}UserSetup-x64-${version}.exe`;
const expectedInstaller = path.join(releaseDir, versionedName);

function cleanDownloadTarget(downloadsDir) {
  if (!existsSync(downloadsDir)) {
    return;
  }

  for (const entryName of readdirSync(downloadsDir)) {
    if (entryName === ".gitkeep") {
      continue;
    }

    rmSync(path.join(downloadsDir, entryName), { recursive: true, force: true });
  }
}

function findInstaller() {
  if (existsSync(expectedInstaller)) {
    return expectedInstaller;
  }

  if (!existsSync(releaseDir)) {
    throw new Error(`Release folder not found: ${releaseDir}`);
  }

  const candidate = readdirSync(releaseDir)
    .filter((name) => name.toLowerCase().endsWith(".exe"))
    .filter((name) => !name.toLowerCase().includes("unpacked"))
    .find((name) => name.includes(version));

  if (!candidate) {
    throw new Error(`No Windows installer for ${version} found in ${releaseDir}`);
  }

  return path.join(releaseDir, candidate);
}

function findBlockmap(installerPath) {
  return [`${installerPath}.blockmap`, path.join(path.dirname(installerPath), `${path.basename(installerPath)}.blockmap`)]
    .find((candidate) => existsSync(candidate));
}

function findReleaseMetadataFiles() {
  return ["latest.yml", "latest.yaml"]
    .map((fileName) => path.join(releaseDir, fileName))
    .filter((filePath) => existsSync(filePath));
}

const installerPath = findInstaller();
const blockmapPath = findBlockmap(installerPath);

if (!blockmapPath) {
  throw new Error(`No matching blockmap found for ${installerPath}`);
}

const releaseMetadataFiles = findReleaseMetadataFiles();
const latest = {
  platform: "windows",
  version,
  file: stableName,
  versionedFile: versionedName,
  blockmapFile: `${stableName}.blockmap`,
  versionedBlockmapFile: `${versionedName}.blockmap`,
  releaseMetadataFiles: releaseMetadataFiles.map((filePath) => path.basename(filePath)),
  generatedAt: new Date().toISOString(),
  fileSizeBytes: statSync(installerPath).size,
};

for (const downloadsDir of downloadTargets) {
  mkdirSync(downloadsDir, { recursive: true });
  cleanDownloadTarget(downloadsDir);

  copyFileSync(installerPath, path.join(downloadsDir, versionedName));
  copyFileSync(installerPath, path.join(downloadsDir, stableName));
  copyFileSync(blockmapPath, path.join(downloadsDir, `${versionedName}.blockmap`));
  copyFileSync(blockmapPath, path.join(downloadsDir, `${stableName}.blockmap`));

  for (const metadataFile of releaseMetadataFiles) {
    copyFileSync(metadataFile, path.join(downloadsDir, path.basename(metadataFile)));
  }

  writeFileSync(path.join(downloadsDir, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
  console.log(`Staged ${stableName} in ${path.relative(rootDir, downloadsDir)}`);
}
