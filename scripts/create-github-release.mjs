#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const OWNER = process.env.GITHUB_OWNER || "mutalvita-cyber";
const REPO = process.env.GITHUB_REPO || "rearvy-desktop-releases";
const TOKEN = process.env.GITHUB_TOKEN || process.env.DESKTOP_RELEASE_TOKEN;
const rootDir = process.cwd();
const websiteDownloadsDir = path.resolve(rootDir, "website/public/downloads");
const legacyDownloadsDir = path.resolve(rootDir, "public/downloads");
const desktopReleaseDir = path.resolve(rootDir, "desktop-release");

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN or DESKTOP_RELEASE_TOKEN environment variable. Create a token that can write releases and set it before upload.");
  process.exit(1);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readLatestJson() {
  for (const filePath of [
    path.join(websiteDownloadsDir, "latest.json"),
    path.join(legacyDownloadsDir, "latest.json"),
  ]) {
    const latest = readJson(filePath);
    if (latest) {
      return { latest, filePath };
    }
  }

  return { latest: null, filePath: null };
}

function readPackageVersion() {
  const pkg = readJson(path.resolve(rootDir, "package.json"));
  return pkg?.version || null;
}

function listDesktopReleaseFiles() {
  if (!fs.existsSync(desktopReleaseDir)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(desktopReleaseDir, { withFileTypes: true })) {
    const entryPath = path.join(desktopReleaseDir, entry.name);

    if (entry.isFile()) {
      files.push(entryPath);
      continue;
    }

    if (!entry.isDirectory() || entry.name === "win-unpacked") {
      continue;
    }

    for (const child of fs.readdirSync(entryPath, { withFileTypes: true })) {
      if (child.isFile()) {
        files.push(path.join(entryPath, child.name));
      }
    }
  }

  return files;
}

function findCurrentInstaller(version, latest) {
  if (latest?.version && latest.version !== version) {
    throw new Error(`latest.json version ${latest.version} does not match package version ${version}. Rebuild the desktop installer first.`);
  }

  const versionedFile = latest?.versionedFile || `RearvyUserSetup-x64-${version}.exe`;
  const stableFile = latest?.file || "RearvyUserSetup-x64.exe";
  const candidatePaths = [
    path.join(websiteDownloadsDir, versionedFile),
    path.join(legacyDownloadsDir, versionedFile),
    path.join(websiteDownloadsDir, stableFile),
    path.join(legacyDownloadsDir, stableFile),
    path.join(desktopReleaseDir, versionedFile),
  ];

  for (const filePath of listDesktopReleaseFiles()) {
    const fileName = path.basename(filePath);
    if (fileName.toLowerCase().endsWith(".exe") && fileName.includes(version)) {
      candidatePaths.push(filePath);
    }
  }

  const filePath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error(`Cannot find current-version installer for ${version}. Looked for:\n${candidatePaths.join("\n")}`);
  }

  return filePath;
}

function findStableInstallerAsset(installerPath, latest) {
  const stableFile = latest?.file || "RearvyUserSetup-x64.exe";

  if (path.basename(installerPath) === stableFile) {
    return null;
  }

  const candidatePaths = [
    path.join(websiteDownloadsDir, stableFile),
    path.join(legacyDownloadsDir, stableFile),
    path.join(desktopReleaseDir, stableFile),
  ];

  return candidatePaths.find(
    (candidate) => fs.existsSync(candidate) && path.resolve(candidate) !== path.resolve(installerPath)
  ) || null;
}

function findCompanionAssets(installerPath, latestJsonPath, latest) {
  const assetMap = new Map();
  const installerDir = path.dirname(installerPath);
  const candidateNames = [
    `${path.basename(installerPath)}.blockmap`,
    latest?.blockmapFile,
    latest?.versionedBlockmapFile,
    "latest.yml",
    "latest.yaml",
    ...(Array.isArray(latest?.releaseMetadataFiles) ? latest.releaseMetadataFiles : []),
  ].filter(Boolean);

  for (const fileName of candidateNames) {
    for (const baseDir of [installerDir, websiteDownloadsDir, legacyDownloadsDir]) {
      const candidatePath = path.join(baseDir, fileName);
      if (fs.existsSync(candidatePath) && candidatePath !== installerPath) {
        assetMap.set(path.basename(candidatePath), candidatePath);
      }
    }
  }

  if (latestJsonPath && fs.existsSync(latestJsonPath)) {
    assetMap.set("latest.json", latestJsonPath);
  }

  return Array.from(assetMap.values());
}

function githubAssetUrl(tag, filePath) {
  return `https://github.com/${OWNER}/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(path.basename(filePath))}`;
}

function githubLatestAssetUrl(fileName) {
  return `https://github.com/${OWNER}/${REPO}/releases/latest/download/${encodeURIComponent(fileName)}`;
}

async function createRelease(tag) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases`;
  const body = {
    tag_name: tag,
    name: tag,
    body: `Automated release ${tag}`,
    draft: false,
    prerelease: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `token ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "User-Agent": `${REPO}-release-script`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create release failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getReleaseByTag(tag) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": `${REPO}-release-script`,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get release failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function deleteAsset(assetId) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${assetId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": `${REPO}-release-script`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete asset failed: ${res.status} ${text}`);
  }
}

async function removeExistingReleaseAsset(release, fileName) {
  const existing = Array.isArray(release.assets)
    ? release.assets.find((asset) => asset.name === fileName)
    : null;

  if (existing) {
    console.log(`Removing existing release asset ${fileName}...`);
    await deleteAsset(existing.id);
  }
}

function uploadAsset(uploadUrl, filename) {
  const escaped = encodeURIComponent(path.basename(filename));
  const url = uploadUrl.replace(/\{.*\}$/, "") + `?name=${escaped}`;
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";

  execFileSync(
    curlBin,
    [
      "--fail-with-body",
      "--silent",
      "--show-error",
      "--http1.1",
      "--location",
      "--request",
      "POST",
      "--header",
      `Authorization: token ${TOKEN}`,
      "--header",
      "Expect:",
      "--header",
      "Content-Type: application/octet-stream",
      "--header",
      "Accept: application/vnd.github+json",
      "--header",
      `User-Agent: ${REPO}-release-script`,
      "--expect100-timeout",
      "0",
      "--data-binary",
      `@${filename}`,
      url,
    ],
    { stdio: "pipe" }
  );
}

function writeLatestJsonCopies(latest) {
  for (const downloadsDir of [websiteDownloadsDir, legacyDownloadsDir]) {
    if (!fs.existsSync(downloadsDir)) {
      continue;
    }

    fs.writeFileSync(path.join(downloadsDir, "latest.json"), `${JSON.stringify(latest, null, 2)}\n`);
  }
}

async function main() {
  const { latest, filePath: latestJsonPath } = readLatestJson();
  const version = readPackageVersion() || latest?.version;
  if (!version) {
    throw new Error("Cannot determine current package version.");
  }

  const tag = `v${version}`;
  const installerPath = findCurrentInstaller(version, latest);
  const installerSizeMb = Math.round(fs.statSync(installerPath).size / 1024 / 1024);
  const installerAssetUrl = githubAssetUrl(tag, installerPath);
  const stableFile = latest?.file || "RearvyUserSetup-x64.exe";
  const stableInstallerAsset = findStableInstallerAsset(installerPath, latest);
  const installerDownloadUrl =
    path.basename(installerPath) === stableFile || stableInstallerAsset
      ? githubLatestAssetUrl(stableFile)
      : installerAssetUrl;

  console.log(`Found installer at ${installerPath} (${installerSizeMb} MB)`);

  const latestForUpload = latest
    ? {
        ...latest,
        url: installerDownloadUrl,
        githubRelease: `https://github.com/${OWNER}/${REPO}/releases/tag/${encodeURIComponent(tag)}`,
      }
    : null;

  if (latestForUpload) {
    writeLatestJsonCopies(latestForUpload);
  }

  const companionAssets = findCompanionAssets(installerPath, latestJsonPath, latestForUpload);
  const assetsToUpload = [installerPath, stableInstallerAsset, ...companionAssets]
    .filter(Boolean)
    .filter((filePath, index, all) => all.findIndex((candidate) => path.basename(candidate) === path.basename(filePath)) === index);

  console.log(`Looking up GitHub release ${tag} on ${OWNER}/${REPO}...`);
  let release = await getReleaseByTag(tag);
  if (!release) {
    console.log(`Creating GitHub release ${tag} on ${OWNER}/${REPO}...`);
    release = await createRelease(tag);
  }
  console.log(`Release ready: id=${release.id}`);

  for (const assetPath of assetsToUpload) {
    const fileName = path.basename(assetPath);
    await removeExistingReleaseAsset(release, fileName);
    console.log(`Uploading asset ${fileName}...`);
    uploadAsset(release.upload_url, assetPath);
    console.log("Uploaded asset:", githubAssetUrl(tag, assetPath));
  }

  console.log("Done. Add the following Vercel env var and redeploy:");
  console.log("Key: NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL");
  console.log(`Value: ${installerDownloadUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
