import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "website", ".next");
const destDir = path.join(rootDir, ".next");

function syncManifests(targetDir) {
  if (!fs.existsSync(targetDir)) return;

  const manifestPairs = [
    ["routes-manifest.json", "routes-manifest-deterministic.json"],
    ["app-path-routes-manifest.json", "app-path-routes-manifest-deterministic.json"],
    ["build-manifest.json", "build-manifest-deterministic.json"],
    ["prerender-manifest.json", "prerender-manifest-deterministic.json"],
    ["fallback-build-manifest.json", "fallback-build-manifest-deterministic.json"],
    ["images-manifest.json", "images-manifest-deterministic.json"],
  ];

  for (const [source, deterministic] of manifestPairs) {
    const srcFile = path.join(targetDir, source);
    const destFile = path.join(targetDir, deterministic);

    if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
      try {
        fs.copyFileSync(srcFile, destFile);
        console.log(`[sync-vercel-output] Created ${deterministic} from ${source} in ${targetDir}`);
      } catch (err) {
        console.warn(`[sync-vercel-output] Failed to copy ${source} to ${deterministic}:`, err.message);
      }
    }
  }
}

console.log("[sync-vercel-output] Checking Next.js build output...");

if (fs.existsSync(srcDir)) {
  // 1. Ensure deterministic manifests exist inside website/.next
  syncManifests(srcDir);

  // 2. Copy website/.next to root .next for Vercel root detection
  try {
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.cpSync(srcDir, destDir, { recursive: true });
    console.log("[sync-vercel-output] Successfully copied website/.next to .next");
  } catch (err) {
    console.warn("[sync-vercel-output] Error copying website/.next to .next:", err.message);
  }

  // 3. Ensure deterministic manifests exist inside root .next as well
  syncManifests(destDir);
} else {
  console.log("[sync-vercel-output] website/.next not found, skipping sync");
}
