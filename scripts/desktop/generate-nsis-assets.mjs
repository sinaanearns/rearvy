#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const logoPath = path.join(repoRoot, "public", "rearvy-logo.png");
const outputPath = path.join(repoRoot, "desktop-app", "build", "nsis-header.bmp");

const header = {
  width: 493,
  height: 58,
  background: { r: 8, g: 10, b: 15 },
};

function writeBmp(filePath, raw, info) {
  const { width, height, channels } = info;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write("BM", 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  for (let y = 0; y < height; y += 1) {
    const sourceY = height - y - 1;
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (sourceY * width + x) * channels;
      const outputOffset = 54 + y * rowSize + x * 3;
      buffer[outputOffset] = raw[sourceOffset + 2];
      buffer[outputOffset + 1] = raw[sourceOffset + 1];
      buffer[outputOffset + 2] = raw[sourceOffset];
    }
  }

  fs.writeFileSync(filePath, buffer);
}

async function imageDataUri(filePath) {
  const image = await sharp(filePath).trim().resize(74, 74, { fit: "inside" }).png().toBuffer();
  return `data:image/png;base64,${image.toString("base64")}`;
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo not found: ${logoPath}`);
  }

  const logo = await imageDataUri(logoPath);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${header.width}" height="${header.height}" viewBox="0 0 ${header.width} ${header.height}">
      <defs>
        <linearGradient id="tile" x1="20" y1="9" x2="60" y2="49" gradientUnits="userSpaceOnUse">
          <stop stop-color="#7b8490"/>
          <stop offset="1" stop-color="#464c56"/>
        </linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.32"/>
        </filter>
      </defs>
      <rect width="493" height="58" fill="#080a0f"/>
      <path d="M112 0H260L298 58H150L112 0Z" fill="#10151f" opacity="0.62"/>
      <path d="M288 0H493V58H366C333 44 305 23 288 0Z" fill="#131820" opacity="0.72"/>
      <path d="M0 57.5H493" stroke="#252c36"/>
      <rect x="23" y="10" width="38" height="38" rx="10" fill="url(#tile)" filter="url(#softShadow)"/>
      <image href="${logo}" x="29" y="16" width="26" height="26" preserveAspectRatio="xMidYMid meet"/>
      <text x="75" y="37" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="800" fill="#ffffff">Rearvy</text>
    </svg>
  `;

  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: header.background })
    .raw()
    .toBuffer({ resolveWithObject: true });

  writeBmp(outputPath, data, info);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
