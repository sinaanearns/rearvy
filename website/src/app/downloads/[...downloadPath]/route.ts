import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OWNER = "mutalvita-cyber";
const REPO = "rearvy-desktop-releases";
const DEFAULT_VERSION = "0.1.2";
const DEFAULT_STABLE_FILE = "RearvyUserSetup-x64.exe";
const DEFAULT_VERSIONED_FILE = `RearvyUserSetup-x64-${DEFAULT_VERSION}.exe`;

function readLatestDownloadMetadata() {
  const latestPath = path.join(process.cwd(), "website", "public", "downloads", "latest.json");

  if (!fs.existsSync(latestPath)) {
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
  if (fileName === DEFAULT_STABLE_FILE) {
    return `https://github.com/${OWNER}/${REPO}/releases/latest/download/${encodeURIComponent(DEFAULT_STABLE_FILE)}`;
  }

  const latest = readLatestDownloadMetadata();
  const version = latest?.version ? `v${latest.version}` : `v${DEFAULT_VERSION}`;
  const stableFile = latest?.file || DEFAULT_STABLE_FILE;
  const versionedFile = latest?.versionedFile || DEFAULT_VERSIONED_FILE;
  const assetName = fileName === stableFile ? versionedFile : fileName;

  return `https://github.com/${OWNER}/${REPO}/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(assetName)}`;
}

export async function GET(
  request: NextRequest,
  context: { params: { downloadPath: string[] } | Promise<{ downloadPath: string[] }> }
) {
  const { downloadPath } = await Promise.resolve(context.params);
  const fileName = downloadPath.join("/");

  if (!fileName) {
    return NextResponse.json({ error: "missing-file" }, { status: 400 });
  }

  if (fileName.toLowerCase().endsWith(".exe")) {
    return NextResponse.redirect(getGitHubAssetUrl(fileName), 302);
  }

  if (fileName === "latest.json") {
    const latest = readLatestDownloadMetadata();
    if (latest) {
      return NextResponse.json(latest, { headers: { "Cache-Control": "no-store" } });
    }
  }

  return NextResponse.json({ error: "not-found", fileName }, { status: 404 });
}
