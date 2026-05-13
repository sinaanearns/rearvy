#!/usr/bin/env node
/**
 * Post-build script: Copy desktop app installer to public downloads folder
 * This runs after electron-builder to make the installer available for download on the website
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const desktopReleasePath = path.join(__dirname, '..', 'desktop-release');
const publicDownloadsPath = path.join(__dirname, '..', 'public', 'downloads');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Ensure public/downloads exists
if (!fs.existsSync(publicDownloadsPath)) {
  fs.mkdirSync(publicDownloadsPath, { recursive: true });
}

// Copy the Windows installer
const sourceExe = path.join(desktopReleasePath, `Rearvy-${version}-win-x64.exe`);
const destExe = path.join(publicDownloadsPath, 'Rearvy-win-x64.exe');

if (fs.existsSync(sourceExe)) {
  fs.copyFileSync(sourceExe, destExe);
  console.log(`✓ Copied ${sourceExe} → ${destExe}`);

  // Copy blockmap for delta updates
  const sourceBlockmap = path.join(desktopReleasePath, `Rearvy-${version}-win-x64.exe.blockmap`);
  const destBlockmap = path.join(publicDownloadsPath, 'Rearvy-win-x64.exe.blockmap');
  if (fs.existsSync(sourceBlockmap)) {
    fs.copyFileSync(sourceBlockmap, destBlockmap);
    console.log(`✓ Copied blockmap for delta updates`);
  }

  // Update latest.json metadata
  const latestJsonPath = path.join(publicDownloadsPath, 'latest.json');
  const fileSize = fs.statSync(destExe).size;
  const latest = {
    platform: 'windows',
    version,
    file: 'Rearvy-win-x64.exe',
    versionedFile: `Rearvy-${version}-win-x64.exe`,
    generatedAt: new Date().toISOString(),
    fileSizeBytes: fileSize,
  };
  fs.writeFileSync(latestJsonPath, JSON.stringify(latest, null, 2));
  console.log(`✓ Updated latest.json (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.warn(`⚠ Desktop installer not found at ${sourceExe}`);
  console.warn('Make sure to run: npm run build:desktop (from desktop-app folder)');
}
