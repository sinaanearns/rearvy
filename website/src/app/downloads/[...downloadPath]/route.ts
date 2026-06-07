import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import websitePackageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

const OWNER = "mutalvita-cyber";
const REPO = "rearvy-desktop-releases";
const DEFAULT_VERSION =
  typeof websitePackageJson.version === "string" && websitePackageJson.version.trim()
    ? websitePackageJson.version
    : "0.1.9";
const DEFAULT_STABLE_FILE = "RearvyUserSetup-x64.exe";
const DEFAULT_VERSIONED_FILE = `RearvyUserSetup-x64-${DEFAULT_VERSION}.exe`;
const LEGACY_INSTALLER_FILES = new Set([
  "rearvy-win-x64.exe",
  "rearvy-0.1.0-win-x64.exe",
]);

function findDownloadFile(fileName: string) {
  const baseName = path.basename(fileName);
  if (baseName !== fileName) {
    return null;
  }

  return [
    path.join(process.cwd(), "public", "downloads", baseName),
    path.join(process.cwd(), "website", "public", "downloads", baseName),
  ].find((candidate) => fs.existsSync(candidate)) ?? null;
}

function readLatestDownloadMetadata() {
  const latestPath = [
    path.join(process.cwd(), "public", "downloads", "latest.json"),
    path.join(process.cwd(), "website", "public", "downloads", "latest.json"),
  ].find((candidate) => fs.existsSync(candidate));

  if (!latestPath) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(latestPath, "utf8")) as {
      version?: string;
      file?: string;
      versionedFile?: string;
    };
  } catch {
    return null;
  }
}

function getGitHubAssetUrl(fileName: string) {
  const baseName = path.basename(fileName);
  if (baseName === DEFAULT_STABLE_FILE || LEGACY_INSTALLER_FILES.has(baseName.toLowerCase())) {
    return `https://github.com/${OWNER}/${REPO}/releases/latest/download/${encodeURIComponent(DEFAULT_STABLE_FILE)}`;
  }

  const latest = readLatestDownloadMetadata();
  const version = latest?.version ? `v${latest.version}` : `v${DEFAULT_VERSION}`;
  const stableFile = latest?.file || DEFAULT_STABLE_FILE;
  const versionedFile = latest?.versionedFile || DEFAULT_VERSIONED_FILE;
  if (baseName !== stableFile && baseName !== versionedFile) {
    return null;
  }

  const assetName = baseName === stableFile ? versionedFile : baseName;

  return `https://github.com/${OWNER}/${REPO}/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(assetName)}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ downloadPath: string[] }> }
) {
  const { downloadPath } = await context.params;
  const fileName = downloadPath.join("/");

  if (!fileName) {
    return NextResponse.json({ error: "missing-file" }, { status: 400 });
  }

  if (fileName.toLowerCase().endsWith(".exe")) {
    const assetUrl = getGitHubAssetUrl(fileName);
    if (!assetUrl) {
      return NextResponse.json({ error: "not-found", fileName }, { status: 404 });
    }

    return NextResponse.redirect(assetUrl, 302);
  }

  if (fileName === "latest.json") {
    const latest = readLatestDownloadMetadata();
    if (latest) {
      return NextResponse.json(latest, { headers: { "Cache-Control": "no-store" } });
    }
  }

  const localFile = findDownloadFile(fileName);
  if (localFile) {
    const ext = path.extname(localFile).toLowerCase();
    const contentType =
      ext === ".yml" || ext === ".yaml"
        ? "application/x-yaml; charset=utf-8"
        : ext === ".blockmap"
          ? "application/octet-stream"
          : "application/octet-stream";

    return new NextResponse(fs.readFileSync(localFile), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      },
    });
  }

  return NextResponse.json({ error: "not-found", fileName }, { status: 404 });
}
