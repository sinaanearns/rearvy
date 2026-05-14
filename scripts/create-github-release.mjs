#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const OWNER = process.env.GITHUB_OWNER || "mutalvita-cyber";
const REPO = process.env.GITHUB_REPO || "rearvy2.0";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN environment variable. Create a personal access token with 'repo' scope and set GITHUB_TOKEN.");
  process.exit(1);
}

function readLatestJson() {
  const p = path.resolve(process.cwd(), "public/downloads/latest.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readPackageVersion() {
  const p = path.resolve(process.cwd(), "package.json");
  if (!fs.existsSync(p)) return null;
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  return pkg.version || null;
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

function uploadAsset(uploadUrl, filename) {
  const escaped = encodeURIComponent(path.basename(filename));
  const url = uploadUrl.replace(/\{.*\}$/, "") + `?name=${escaped}`;

  execFileSync(
    "curl.exe",
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

async function main() {
  const latest = readLatestJson();
  const version = readPackageVersion() || latest?.version || "0.1.1";
  const tag = `v${version}`;

  // prefer desktop-release artifact if present
  const candidatePaths = [
    path.resolve(process.cwd(), "desktop-release/RearvyUserSetup-x64.exe"),
    path.resolve(process.cwd(), "public/downloads/RearvyUserSetup-x64.exe"),
    path.resolve(process.cwd(), "public/downloads/" + (latest?.versionedFile || `RearvyUserSetup-x64-${version}.exe`)),
    path.resolve(process.cwd(), "desktop-release/" + `RearvyUserSetup-x64-${version}.exe`),
  ];

  const filePath = candidatePaths.find((p) => fs.existsSync(p));
  if (!filePath) {
    console.error("Cannot find installer. Looked for:", candidatePaths.join("\n"));
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  console.log(`Found installer at ${filePath} (${Math.round(buffer.length/1024/1024)} MB)`);

  console.log(`Looking up GitHub release ${tag} on ${OWNER}/${REPO}...`);
  let release = await getReleaseByTag(tag);
  if (!release) {
    console.log(`Creating GitHub release ${tag} on ${OWNER}/${REPO}...`);
    release = await createRelease(tag);
  }
  console.log(`Release created: id=${release.id}`);

  console.log(`Uploading asset ${path.basename(filePath)}...`);
  uploadAsset(release.upload_url, filePath);
  const assetUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(path.basename(filePath))}`;
  console.log("Uploaded asset:", assetUrl);

  // update local latest.json with public url field
  if (latest) {
    latest.url = assetUrl;
    fs.writeFileSync(path.resolve(process.cwd(), "public/downloads/latest.json"), JSON.stringify(latest, null, 2));
    console.log("Updated public/downloads/latest.json with 'url'");
  }

  console.log("Done. Add the following Vercel env var and redeploy:");
  console.log("Key: NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL");
  console.log(`Value: ${assetUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
