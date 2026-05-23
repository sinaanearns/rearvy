#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const DEFAULT_OWNER = "mutalvita-cyber";
const DEFAULT_REPO = "rearvy-desktop-releases";
const PRIVATE_SOURCE_REPO = "mutalvita-cyber/rearvy2.0";
const OWNER = process.env.REARVY_RELEASE_GITHUB_OWNER || process.env.GITHUB_OWNER || DEFAULT_OWNER;
const REPO = process.env.REARVY_RELEASE_GITHUB_REPO || process.env.GITHUB_REPO || DEFAULT_REPO;
const TOKEN = process.env.GITHUB_TOKEN || process.env.DESKTOP_RELEASE_TOKEN;
const rootDir = process.cwd();
const websiteDownloadsDir = path.resolve(rootDir, "website/public/downloads");
const legacyDownloadsDir = path.resolve(rootDir, "public/downloads");
const desktopReleaseDir = path.resolve(rootDir, "desktop-release");
const MAX_GITHUB_ATTEMPTS = 5;
const RETRYABLE_GITHUB_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN or DESKTOP_RELEASE_TOKEN environment variable. Create a token that can write releases and set it before upload.");
  process.exit(1);
}

if (`${OWNER}/${REPO}`.toLowerCase() === PRIVATE_SOURCE_REPO && process.env.REARVY_ALLOW_SOURCE_REPO_RELEASES !== "true") {
  console.error(
    `Refusing to publish desktop update artifacts to private source repo ${PRIVATE_SOURCE_REPO}. ` +
      `Set REARVY_RELEASE_GITHUB_REPO=${DEFAULT_REPO}, or set REARVY_ALLOW_SOURCE_REPO_RELEASES=true only for an intentional one-off.`
  );
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options, label, okStatuses = []) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_GITHUB_ATTEMPTS; attempt += 1) {
    let res;

    try {
      res = await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_GITHUB_ATTEMPTS) {
        throw error;
      }
    }

    if (res && (res.ok || okStatuses.includes(res.status))) {
      return res;
    }

    if (res) {
      const text = await res.text();
      lastError = new Error(`${label} failed: ${res.status} ${text}`);

      if (!RETRYABLE_GITHUB_STATUSES.has(res.status) || attempt === MAX_GITHUB_ATTEMPTS) {
        throw lastError;
      }

      console.warn(`${label} failed with GitHub ${res.status}; retrying (${attempt}/${MAX_GITHUB_ATTEMPTS})...`);
    }

    await sleep(Math.min(1000 * 2 ** attempt, 10000));
  }

  throw lastError || new Error(`${label} failed after ${MAX_GITHUB_ATTEMPTS} attempts.`);
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

function githubHeaders(extraHeaders = {}) {
  return {
    Authorization: `token ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": `${REPO}-release-script`,
    ...extraHeaders,
  };
}

async function ensureReleaseRepoInitialized() {
  const repoUrl = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const repoRes = await fetchWithRetry(
    repoUrl,
    {
      headers: githubHeaders(),
    },
    "Get release repo"
  );
  const repo = await repoRes.json();
  const defaultBranch = repo.default_branch || "main";

  const commitsUrl = `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=1`;
  const commitsRes = await fetchWithRetry(
    commitsUrl,
    {
      headers: githubHeaders(),
    },
    "List release repo commits",
    [409]
  );

  if (commitsRes.status !== 409) {
    return;
  }

  console.log(`Release repo ${OWNER}/${REPO} is empty; creating initial README.md on ${defaultBranch}...`);
  const readmeBody = [
    "# Rearvy Desktop Releases",
    "",
    "Public release artifacts for Rearvy Desktop.",
    "",
  ].join("\n");

  await fetchWithRetry(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/README.md`,
    {
      method: "PUT",
      headers: githubHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        message: "Initialize desktop release repository",
        content: Buffer.from(readmeBody, "utf8").toString("base64"),
        branch: defaultBranch,
      }),
    },
    "Initialize release repo"
  );
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

  let res;
  try {
    res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          ...githubHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      "Create release"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Resource not accessible by personal access token") || message.includes("Create release failed: 403")) {
      throw new Error(
        `Create release failed because the token cannot write releases in ${OWNER}/${REPO}. ` +
          `Recreate DESKTOP_RELEASE_TOKEN with Repository permissions > Contents: Read and write for ${OWNER}/${REPO}, ` +
          "approve the fine-grained token in the organization if GitHub asks for approval, then update the secret in the source repo."
      );
    }

    throw error;
  }
  return res.json();
}

async function getReleaseByTag(tag) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}`;
  const res = await fetchWithRetry(
    url,
    {
      headers: {
        ...githubHeaders(),
      },
    },
    "Get release",
    [404]
  );

  if (res.status === 404) return null;

  return res.json();
}

async function deleteAsset(assetId) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${assetId}`;
  await fetchWithRetry(
    url,
    {
      method: "DELETE",
      headers: {
        ...githubHeaders(),
      },
    },
    "Delete asset",
    [404]
  );
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
      "--retry",
      "5",
      "--retry-delay",
      "2",
      "--retry-all-errors",
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
  await ensureReleaseRepoInitialized();
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
