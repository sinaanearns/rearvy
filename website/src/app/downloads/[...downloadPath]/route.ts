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
const LEGACY_INSTALLER_FILES = new Set([
  "rearvy-win-x64.exe",
  "rearvy-0.1.0-win-x64.exe",
]);

type DownloadPlatform = "windows" | "mac";

type LatestDownloadMetadata = Record<string, unknown> & {
  platform: DownloadPlatform;
  version: string;
  file: string;
  versionedFile: string;
  url: string;
  githubRelease: string;
  companionFile?: string;
  versionedCompanionFile?: string;
};

const PLATFORM_DOWNLOADS: Record<
  DownloadPlatform,
  {
    latestJsonFile: string;
    fallbackLatestJsonFiles: string[];
    stableFile: string;
    versionedFile: string;
    extensions: string[];
    companionFile?: string;
    versionedCompanionFile?: string;
  }
> = {
  windows: {
    latestJsonFile: "latest-windows.json",
    fallbackLatestJsonFiles: ["latest.json"],
    stableFile: "RearvyUserSetup-x64.exe",
    versionedFile: `RearvyUserSetup-x64-${DEFAULT_VERSION}.exe`,
    extensions: [".exe"],
  },
  mac: {
    latestJsonFile: "latest-mac.json",
    fallbackLatestJsonFiles: [],
    stableFile: "Rearvy-mac-universal.dmg",
    versionedFile: `Rearvy-mac-universal-${DEFAULT_VERSION}.dmg`,
    companionFile: "Rearvy-mac-universal.zip",
    versionedCompanionFile: `Rearvy-mac-universal-${DEFAULT_VERSION}.zip`,
    extensions: [".dmg", ".zip"],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isSafeDownloadFileName(fileName: string) {
  return (
    fileName.length > 0 &&
    fileName.length <= 180 &&
    !fileName.includes("/") &&
    !fileName.includes("\\") &&
    !fileName.includes("\0") &&
    fileName !== "." &&
    fileName !== ".." &&
    path.basename(fileName) === fileName
  );
}

function getInstallerFileName(value: unknown, platform: DownloadPlatform) {
  const fileName = getTrimmedString(value);
  const extension = fileName ? path.extname(fileName).toLowerCase() : "";
  if (
    !fileName ||
    !isSafeDownloadFileName(fileName) ||
    !PLATFORM_DOWNLOADS[platform].extensions.includes(extension)
  ) {
    return null;
  }

  return fileName;
}

function findDownloadFile(fileName: string) {
  if (!isSafeDownloadFileName(fileName)) {
    return null;
  }

  return [
    path.join(process.cwd(), "public", "downloads", fileName),
    path.join(process.cwd(), "website", "public", "downloads", fileName),
  ].find((candidate) => fs.existsSync(candidate)) ?? null;
}

function normalizeLatestDownloadMetadata(
  value: unknown,
  platform: DownloadPlatform
): LatestDownloadMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawPlatform = getTrimmedString(value.platform);
  if (rawPlatform && rawPlatform !== platform) {
    return null;
  }

  const version = getTrimmedString(value.version);
  const file = getInstallerFileName(value.file, platform);
  const versionedFile = getInstallerFileName(value.versionedFile, platform);
  if (!version || !file || !versionedFile) {
    return null;
  }

  const companionFile = getInstallerFileName(value.companionFile, platform) ?? undefined;
  const versionedCompanionFile =
    getInstallerFileName(value.versionedCompanionFile, platform) ?? undefined;

  return {
    ...value,
    platform,
    version,
    file,
    versionedFile,
    ...(companionFile ? { companionFile } : {}),
    ...(versionedCompanionFile ? { versionedCompanionFile } : {}),
    url:
      getTrimmedString(value.url) ??
      `https://github.com/${OWNER}/${REPO}/releases/latest/download/${file}`,
    githubRelease:
      getTrimmedString(value.githubRelease) ??
      `https://github.com/${OWNER}/${REPO}/releases/tag/v${version}`,
  };
}

function readLatestDownloadMetadata(platform: DownloadPlatform) {
  const config = PLATFORM_DOWNLOADS[platform];
  const metadataFileNames = [config.latestJsonFile, ...config.fallbackLatestJsonFiles];
  const latestPath = metadataFileNames
    .flatMap((fileName) => [
      path.join(process.cwd(), "public", "downloads", fileName),
      path.join(process.cwd(), "website", "public", "downloads", fileName),
    ])
    .find((candidate) => fs.existsSync(candidate));

  if (!latestPath) {
    return null;
  }

  try {
    return normalizeLatestDownloadMetadata(JSON.parse(fs.readFileSync(latestPath, "utf8")), platform);
  } catch {
    return null;
  }
}

function buildDefaultLatestDownloadMetadata(platform: DownloadPlatform): LatestDownloadMetadata {
  const config = PLATFORM_DOWNLOADS[platform];
  return {
    platform,
    version: DEFAULT_VERSION,
    file: config.stableFile,
    versionedFile: config.versionedFile,
    ...(config.companionFile ? { companionFile: config.companionFile } : {}),
    ...(config.versionedCompanionFile ? { versionedCompanionFile: config.versionedCompanionFile } : {}),
    url: `https://github.com/${OWNER}/${REPO}/releases/latest/download/${config.stableFile}`,
    githubRelease: `https://github.com/${OWNER}/${REPO}/releases/tag/v${DEFAULT_VERSION}`,
  };
}

function getLatestDownloadMetadata(platform: DownloadPlatform): LatestDownloadMetadata {
  return readLatestDownloadMetadata(platform) ?? buildDefaultLatestDownloadMetadata(platform);
}

function inferInstallerPlatform(fileName: string): DownloadPlatform | null {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".exe") {
    return "windows";
  }

  if (extension === ".dmg" || extension === ".zip") {
    return "mac";
  }

  return null;
}

function getGitHubAssetUrl(fileName: string) {
  if (!isSafeDownloadFileName(fileName)) {
    return null;
  }

  const baseName = fileName;
  const windowsStableFile = PLATFORM_DOWNLOADS.windows.stableFile;
  if (baseName === windowsStableFile || LEGACY_INSTALLER_FILES.has(baseName.toLowerCase())) {
    return `https://github.com/${OWNER}/${REPO}/releases/latest/download/${encodeURIComponent(windowsStableFile)}`;
  }

  const platform = inferInstallerPlatform(baseName);
  if (!platform) {
    return null;
  }

  const latest = getLatestDownloadMetadata(platform);
  const version = `v${latest.version}`;
  const stableFiles = [latest.file, latest.companionFile].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  const versionedFiles = [latest.versionedFile, latest.versionedCompanionFile].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  const knownFiles = new Set([...stableFiles, ...versionedFiles]);
  if (!knownFiles.has(baseName)) {
    return null;
  }

  if (stableFiles.includes(baseName)) {
    return `https://github.com/${OWNER}/${REPO}/releases/latest/download/${encodeURIComponent(baseName)}`;
  }

  return `https://github.com/${OWNER}/${REPO}/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(baseName)}`;
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

  if ([".exe", ".dmg", ".zip"].includes(path.extname(fileName).toLowerCase())) {
    const assetUrl = getGitHubAssetUrl(fileName);
    if (!assetUrl) {
      return NextResponse.json({ error: "not-found", fileName }, { status: 404 });
    }

    return NextResponse.redirect(assetUrl, 302);
  }

  if (fileName === "latest.json" || fileName === "latest-windows.json") {
    return NextResponse.json(getLatestDownloadMetadata("windows"), { headers: { "Cache-Control": "no-store" } });
  }

  if (fileName === "latest-mac.json") {
    return NextResponse.json(getLatestDownloadMetadata("mac"), { headers: { "Cache-Control": "no-store" } });
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
