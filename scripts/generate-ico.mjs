#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

function buildIcoBuffer(images) {
  const headerSize = 6;
  const directoryEntrySize = 16;
  const directorySize = images.length * directoryEntrySize;

  let offset = headerSize + directorySize;
  const directoryEntries = images.map(({ width, height, buffer }) => {
    const entry = Buffer.alloc(directoryEntrySize);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buffer.length;
    return entry;
  });

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  return Buffer.concat([header, ...directoryEntries, ...images.map(({ buffer }) => buffer)]);
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const publicDir = path.join(repoRoot, 'public');
  const sourceCandidates = ['favicon.png', 'rearvy-logo.png', 'favicon.svg'];
  const sourcePath = sourceCandidates
    .map((fileName) => path.join(publicDir, fileName))
    .find((candidate) => fs.existsSync(candidate));
  const websitePublicDir = path.join(repoRoot, 'website', 'public');
  const outputDirs = [publicDir];

  if (fs.existsSync(websitePublicDir)) {
    outputDirs.push(websitePublicDir);
  }

  if (!sourcePath) {
    console.error('No icon source found in', publicDir);
    process.exit(1);
  }

  // Sizes commonly included in ICO files
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = [];

  for (const size of sizes) {
    const buffer = await sharp(sourcePath)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toBuffer();

    images.push({ width: size, height: size, buffer });
  }

  const icoBuffer = buildIcoBuffer(images);
  const writtenFiles = [];

  for (const outputDir of outputDirs) {
    for (const fileName of ['rearvy.ico', 'favicon.ico']) {
      const outputPath = path.join(outputDir, fileName);
      fs.writeFileSync(outputPath, icoBuffer);
      writtenFiles.push(outputPath);
    }
  }

  console.log('Wrote', writtenFiles.join(', '));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
