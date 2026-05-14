#!/usr/bin/env node
/**
 * Post-build script: Copy desktop app installer to public downloads folder
 * This runs after electron-builder to make the installer available for download on the website
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopReleasePath = process.env.DESKTOP_RELEASE_DIR
  ? path.resolve(process.env.DESKTOP_RELEASE_DIR)
  : path.join(__dirname, '..', 'desktop-release');
const publicDownloadsPath = path.join(__dirname, '..', 'public', 'downloads');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Ensure public/downloads exists
if (!fs.existsSync(publicDownloadsPath)) {
  fs.mkdirSync(publicDownloadsPath, { recursive: true });
}

// Copy the Windows installer.
// Electron Builder can emit version-specific names that vary by configuration, so we
// resolve the first usable installer in desktop-release and stage it under a stable name.
const stableInstallerName = 'RearvyUserSetup-x64.exe';
const expectedVersionedName = `RearvyUserSetup-x64-${version}.exe`;
const stagedInstallerPath = path.join(publicDownloadsPath, stableInstallerName);

let sourceExe = path.join(desktopReleasePath, expectedVersionedName);
if (!fs.existsSync(sourceExe)) {
  const exeCandidates = fs
    .readdirSync(desktopReleasePath)
    .filter((fileName) => fileName.toLowerCase().endsWith('.exe'))
    .filter((fileName) => !fileName.toLowerCase().includes('unpacked'));
  const preferredName = exeCandidates.find((fileName) => fileName.toLowerCase().includes('rearvy')) || exeCandidates[0];
  if (preferredName) {
    sourceExe = path.join(desktopReleasePath, preferredName);
    console.warn(`⚠ Expected ${expectedVersionedName} not found; falling back to ${preferredName}`);
  }
}

if (fs.existsSync(sourceExe)) {
  fs.copyFileSync(sourceExe, stagedInstallerPath);
  console.log(`✓ Copied ${sourceExe} → ${stagedInstallerPath}`);

  // Copy blockmap for delta updates if available.
  const sourceBlockmapCandidates = [
    `${sourceExe}.blockmap`,
    path.join(desktopReleasePath, `${path.basename(sourceExe)}.blockmap`),
  ];
  const stagedBlockmapPath = path.join(publicDownloadsPath, `${stableInstallerName}.blockmap`);
  for (const candidate of sourceBlockmapCandidates) {
    if (fs.existsSync(candidate)) {
      fs.copyFileSync(candidate, stagedBlockmapPath);
      console.log(`✓ Copied blockmap ${candidate} → ${stagedBlockmapPath}`);
      break;
    }
  }

  // Update latest.json metadata.
  const latestJsonPath = path.join(publicDownloadsPath, 'latest.json');
  const fileSize = fs.statSync(stagedInstallerPath).size;
  const latest = {
    platform: 'windows',
    version,
    file: stableInstallerName,
    versionedFile: path.basename(sourceExe),
    generatedAt: new Date().toISOString(),
    fileSizeBytes: fileSize,
  };
  fs.writeFileSync(latestJsonPath, JSON.stringify(latest, null, 2));
  console.log(`✓ Updated latest.json (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.warn(`⚠ No Windows installer (.exe) found in ${desktopReleasePath}`);
  console.warn('Make sure to run: npm run build:desktop (from desktop-app folder)');
}
