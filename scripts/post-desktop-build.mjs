#!/usr/bin/env node
/**
 * Stage the current Windows desktop installer for the website download page.
 *
 * This script intentionally refuses to copy stale installers. The desktop app
 * version must match the root package version, and the selected installer must
 * contain that exact version in its filename.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

const desktopReleasePath = process.env.DESKTOP_RELEASE_DIR
  ? path.resolve(process.env.DESKTOP_RELEASE_DIR)
  : path.join(rootDir, "desktop-release");
const downloadsTargets = [
  path.join(rootDir, "website", "public", "downloads"),
  path.join(rootDir, "public", "downloads"),
];
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const desktopPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "desktop-app", "package.json"), "utf8"));
const version = rootPackageJson.version;

if (desktopPackageJson.version !== version) {
  throw new Error(`Desktop package version ${desktopPackageJson.version} does not match root version ${version}.`);
}

const productName = desktopPackageJson.build?.productName || "Rearvy";
const stableInstallerName = `${productName}UserSetup-x64.exe`;
const versionedInstallerName = `${productName}UserSetup-x64-${version}.exe`;

function cleanDownloadTarget(downloadsPath) {
  if (!fs.existsSync(downloadsPath)) {
    return;
  }

  for (const entryName of fs.readdirSync(downloadsPath)) {
    if (entryName === ".gitkeep") {
      continue;
    }

    fs.rmSync(path.join(downloadsPath, entryName), { recursive: true, force: true });
  }
}

function findCurrentInstaller() {
  if (!fs.existsSync(desktopReleasePath)) {
    throw new Error(`Desktop release folder does not exist: ${desktopReleasePath}`);
  }

  const exactPath = path.join(desktopReleasePath, versionedInstallerName);
  if (fs.existsSync(exactPath)) {
    return exactPath;
  }

  const candidates = fs
    .readdirSync(desktopReleasePath)
    .filter((fileName) => fileName.toLowerCase().endsWith(".exe"))
    .filter((fileName) => !fileName.toLowerCase().includes("unpacked"))
    .filter((fileName) => fileName.includes(version));

  if (candidates.length === 1) {
    return path.join(desktopReleasePath, candidates[0]);
  }

  if (candidates.length > 1) {
    throw new Error(`Multiple current-version installers found: ${candidates.join(", ")}`);
  }

  const found = fs
    .readdirSync(desktopReleasePath)
    .filter((fileName) => fileName.toLowerCase().endsWith(".exe"))
    .join(", ") || "none";
  throw new Error(`No current-version installer for ${version} found in ${desktopReleasePath}. Found: ${found}`);
}

function findBlockmap(installerPath) {
  const candidates = [
    `${installerPath}.blockmap`,
    path.join(path.dirname(installerPath), `${path.basename(installerPath)}.blockmap`),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function findReleaseMetadataFiles() {
  return ["latest.yml", "latest.yaml"]
    .map((fileName) => path.join(desktopReleasePath, fileName))
    .filter((filePath) => fs.existsSync(filePath));
}

const sourceInstallerPath = findCurrentInstaller();
const sourceBlockmapPath = findBlockmap(sourceInstallerPath);
if (!sourceBlockmapPath) {
  throw new Error(`No matching blockmap found for ${sourceInstallerPath}`);
}

const releaseMetadataFiles = findReleaseMetadataFiles();
const fileSize = fs.statSync(sourceInstallerPath).size;
const latest = {
  platform: "windows",
  version,
  file: stableInstallerName,
  versionedFile: versionedInstallerName,
  blockmapFile: `${stableInstallerName}.blockmap`,
  versionedBlockmapFile: `${versionedInstallerName}.blockmap`,
  releaseMetadataFiles: releaseMetadataFiles.map((filePath) => path.basename(filePath)),
  generatedAt: new Date().toISOString(),
  fileSizeBytes: fileSize,
};

for (const downloadsPath of downloadsTargets) {
  fs.mkdirSync(downloadsPath, { recursive: true });
  cleanDownloadTarget(downloadsPath);

  fs.copyFileSync(sourceInstallerPath, path.join(downloadsPath, stableInstallerName));
  fs.copyFileSync(sourceInstallerPath, path.join(downloadsPath, versionedInstallerName));
  fs.copyFileSync(sourceBlockmapPath, path.join(downloadsPath, `${stableInstallerName}.blockmap`));
  fs.copyFileSync(sourceBlockmapPath, path.join(downloadsPath, `${versionedInstallerName}.blockmap`));

  for (const metadataFile of releaseMetadataFiles) {
    fs.copyFileSync(metadataFile, path.join(downloadsPath, path.basename(metadataFile)));
  }

  fs.writeFileSync(path.join(downloadsPath, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
  console.log(`Staged ${stableInstallerName} in ${path.relative(rootDir, downloadsPath)}`);
}

console.log(`Staged ${stableInstallerName} from ${sourceInstallerPath}`);
console.log(`Staged matching blockmap from ${sourceBlockmapPath}`);
