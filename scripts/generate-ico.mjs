#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import toIco from 'to-ico';

async function main() {
  const repoRoot = path.resolve(new URL(import.meta.url).pathname, '..', '..');
  const publicDir = path.join(repoRoot, 'public');
  const svgPath = path.join(publicDir, 'favicon.svg');
  const outIco = path.join(publicDir, 'rearvy.ico');

  if (!fs.existsSync(svgPath)) {
    console.error('favicon.svg not found at', svgPath);
    process.exit(1);
  }

  // Sizes commonly included in ICO files
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const tmpPngs = [];

  try {
    for (const s of sizes) {
      const outPng = path.join(publicDir, `._rearvy_${s}.png`);
      await sharp(svgPath)
        .resize(s, s, { fit: 'contain' })
        .png()
        .toFile(outPng);
      tmpPngs.push(outPng);
    }

    // Read PNG buffers and convert to ICO
    const pngBuffers = tmpPngs.map((p) => fs.readFileSync(p));
    const icoBuffer = await toIco(pngBuffers);
    fs.writeFileSync(outIco, icoBuffer);
    console.log('Wrote', outIco);
  } finally {
    // cleanup temporary pngs
    for (const p of tmpPngs) {
      try { fs.unlinkSync(p); } catch (e) {}
    }
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
