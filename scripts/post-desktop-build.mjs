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
import { assertDesktopReleaseVersions } from "./desktop/assert-release-versions.mjs";

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
const RELEASE_OWNER = "mutalvita-cyber";
const RELEASE_REPO = "rearvy-desktop-releases";
const desktopPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "desktop-app", "package.json"), "utf8"));
const { version } = assertDesktopReleaseVersions(rootDir);

const productName = desktopPackageJson.build?.productName || "Rearvy";
const stableInstallerName = `${productName}UserSetup-x64.exe`;
const versionedInstallerName = `${productName}UserSetup-x64-${version}.exe`;
const releaseTag = `v${version}`;

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

function listDesktopReleaseFiles() {
  if (!fs.existsSync(desktopReleasePath)) {
    return [];
  }

  const files = [];
  const pendingDirs = [desktopReleasePath];

  while (pendingDirs.length > 0) {
    const currentDir = pendingDirs.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isFile()) {
        files.push(entryPath);
        continue;
      }

      if (entry.isDirectory() && entry.name !== "win-unpacked") {
        pendingDirs.push(entryPath);
      }
    }
  }

  return files;
}

function findCurrentInstaller() {
  if (!fs.existsSync(desktopReleasePath)) {
    throw new Error(`Desktop release folder does not exist: ${desktopReleasePath}`);
  }

  const exactPath = path.join(desktopReleasePath, versionedInstallerName);
  if (fs.existsSync(exactPath)) {
    return exactPath;
  }

  const candidates = listDesktopReleaseFiles()
    .filter((filePath) => path.basename(filePath).toLowerCase().endsWith(".exe"))
    .filter((filePath) => path.basename(filePath).includes(version))
    .sort((left, right) => {
      const rightMtime = fs.statSync(right).mtimeMs;
      const leftMtime = fs.statSync(left).mtimeMs;
      return rightMtime - leftMtime || right.localeCompare(left);
    });

  if (candidates.length > 0) {
    return candidates[0];
  }

  const found = listDesktopReleaseFiles()
    .filter((filePath) => path.basename(filePath).toLowerCase().endsWith(".exe"))
    .map((filePath) => path.relative(desktopReleasePath, filePath))
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

function findReleaseMetadataFiles(installerPath) {
  const releaseDirs = [path.dirname(installerPath), desktopReleasePath]
    .filter((releaseDir, index, all) => all.findIndex((candidate) => path.resolve(candidate) === path.resolve(releaseDir)) === index);

  return ["latest.yml", "latest.yaml"]
    .map((fileName) => releaseDirs.map((releaseDir) => path.join(releaseDir, fileName)).find((filePath) => fs.existsSync(filePath)))
    .filter(Boolean);
}

const sourceInstallerPath = findCurrentInstaller();
const sourceBlockmapPath = findBlockmap(sourceInstallerPath);
if (!sourceBlockmapPath) {
  throw new Error(`No matching blockmap found for ${sourceInstallerPath}`);
}

const releaseMetadataFiles = findReleaseMetadataFiles(sourceInstallerPath);
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
  url: `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/latest/download/${stableInstallerName}`,
  githubRelease: `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/tag/${releaseTag}`,
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
