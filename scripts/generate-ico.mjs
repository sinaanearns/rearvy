#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICON_SCALE = 0.9;
const ALPHA_THRESHOLD = 0;

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

async function getVisibleBounds(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];

      if (alpha > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`No visible pixels found in ${sourcePath}`);
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function renderIconPng(croppedSource, size) {
  const innerSize = Math.max(1, Math.round(size * ICON_SCALE));
  const { data, info } = await sharp(croppedSource)
    .resize({ width: innerSize, height: innerSize, fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer({ resolveWithObject: true });

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: data,
        left: Math.floor((size - info.width) / 2),
        top: Math.floor((size - info.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const publicDir = path.join(repoRoot, 'public');
  const sourceCandidates = ['rearvy-logo.png', 'favicon.png', 'favicon.svg'];
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

  const visibleBounds = await getVisibleBounds(sourcePath);
  const croppedSource = await sharp(sourcePath).extract(visibleBounds).png().toBuffer();
  const images = [];

  for (const size of ICON_SIZES) {
    const buffer = await renderIconPng(croppedSource, size);

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
