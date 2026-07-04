import fs, { type PathLike } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

import websitePackageJson from "../../../../package.json";
import latestDownloadMetadata from "../../../../public/downloads/latest.json";
import { GET } from "./route";

const latestMetadata = latestDownloadMetadata as {
  version: string;
  versionedFile: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeContext(downloadPath: string[]) {
  return { params: Promise.resolve({ downloadPath }) };
}

function makeRequest(pathname: string) {
  return new Request(`https://www.rearvy.com${pathname}`);
}

function getPackageVersion() {
  return typeof websitePackageJson.version === "string" && websitePackageJson.version.trim()
    ? websitePackageJson.version
    : "0.1.9";
}

function normalizeMockedFsPath(filePath: PathLike | number) {
  if (filePath instanceof URL) {
    return filePath.pathname;
  }

  return String(filePath).replace(/\\/g, "/");
}

test("downloads route serves latest updater metadata", async (t) => {
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);
  
  t.mock.method(fs, "existsSync", (filePath: PathLike) => {
    const normalizedPath = normalizeMockedFsPath(filePath);
    if (normalizedPath.endsWith("/downloads/latest.yml")) {
      return true;
    }
    return originalExistsSync(filePath);
  });

  t.mock.method(fs, "readFileSync", (filePath: PathLike | number, options?: any) => {
    const normalizedPath = normalizeMockedFsPath(filePath);
    if (normalizedPath.endsWith("/downloads/latest.yml")) {
      return `version: ${latestMetadata.version}\npath: ${latestMetadata.versionedFile}`;
    }
    return originalReadFileSync(filePath as any, options);
  });

  const response = await GET(
    makeRequest("/downloads/latest.yml"),
    makeContext(["latest.yml"])
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /ya?ml/i);
  const text = await response.text();
  assert.match(text, new RegExp(`version:\\s*${escapeRegExp(latestMetadata.version)}`));
  assert.match(text, new RegExp(escapeRegExp(latestMetadata.versionedFile)));
});

test("downloads route serves latest JSON metadata", async () => {
  const response = await GET(
    makeRequest("/downloads/latest.json"),
    makeContext(["latest.json"])
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as { version?: string; file?: string; versionedFile?: string };
  assert.equal(payload.version, latestMetadata.version);
  assert.equal(payload.file, "RearvyUserSetup-x64.exe");
  assert.equal(payload.versionedFile, latestMetadata.versionedFile);
});

test("downloads route serves default macOS JSON metadata", async () => {
  const response = await GET(
    makeRequest("/downloads/latest-mac.json"),
    makeContext(["latest-mac.json"])
  );

  const packageVersion = getPackageVersion();

  assert.equal(response.status, 200);
  const payload = await response.json() as {
    platform?: string;
    arch?: string;
    version?: string;
    file?: string;
    versionedFile?: string;
    companionFile?: string;
    versionedCompanionFile?: string;
    url?: string;
  };
  assert.equal(payload.platform, "mac");
  assert.equal(payload.version, packageVersion);
  assert.equal(payload.file, "Rearvy-mac-universal.dmg");
  assert.equal(payload.versionedFile, `Rearvy-mac-universal-${packageVersion}.dmg`);
  assert.equal(payload.companionFile, "Rearvy-mac-universal.zip");
  assert.equal(payload.versionedCompanionFile, `Rearvy-mac-universal-${packageVersion}.zip`);
  assert.equal(
    payload.url,
    "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/Rearvy-mac-universal.dmg"
  );
});

test("downloads route builds latest JSON metadata when staged metadata is unavailable", async (t) => {
  const originalExistsSync = fs.existsSync.bind(fs);
  t.mock.method(fs, "existsSync", (filePath: PathLike) => {
    const normalizedPath = filePath instanceof URL
      ? filePath.pathname
      : String(filePath).replace(/\\/g, "/");

    if (
      normalizedPath.endsWith("/downloads/latest.json") ||
      normalizedPath.endsWith("/downloads/latest-windows.json")
    ) {
      return false;
    }

    return originalExistsSync(filePath);
  });

  const response = await GET(
    makeRequest("/downloads/latest.json"),
    makeContext(["latest.json"])
  );

  const packageVersion = getPackageVersion();

  assert.equal(response.status, 200);
  const payload = await response.json() as {
    platform?: string;
    version?: string;
    file?: string;
    versionedFile?: string;
    url?: string;
    githubRelease?: string;
  };
  assert.equal(payload.platform, "windows");
  assert.equal(payload.version, packageVersion);
  assert.equal(payload.file, "RearvyUserSetup-x64.exe");
  assert.equal(payload.versionedFile, `RearvyUserSetup-x64-${packageVersion}.exe`);
  assert.equal(
    payload.url,
    "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/RearvyUserSetup-x64.exe"
  );
  assert.equal(
    payload.githubRelease,
    `https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/tag/v${packageVersion}`
  );
});

test("downloads route ignores corrupt staged latest JSON metadata", async (t) => {
  const originalReadFileSync = fs.readFileSync.bind(fs);
  t.mock.method(
    fs,
    "readFileSync",
    (
      filePath: PathLike | number,
      options?: BufferEncoding | null | { encoding?: BufferEncoding | null; flag?: string }
    ) => {
      const normalizedPath = normalizeMockedFsPath(filePath);
      if (
        normalizedPath.endsWith("/downloads/latest.json") ||
        normalizedPath.endsWith("/downloads/latest-windows.json")
      ) {
        return JSON.stringify({
          version: 123,
          file: "../RearvyUserSetup-x64.exe",
          versionedFile: "",
        });
      }

      return originalReadFileSync(filePath as never, options as never);
    }
  );

  const response = await GET(
    makeRequest("/downloads/latest.json"),
    makeContext(["latest.json"])
  );

  const packageVersion = getPackageVersion();

  assert.equal(response.status, 200);
  const payload = await response.json() as { version?: string; file?: string; versionedFile?: string };
  assert.equal(payload.version, packageVersion);
  assert.equal(payload.file, "RearvyUserSetup-x64.exe");
  assert.equal(payload.versionedFile, `RearvyUserSetup-x64-${packageVersion}.exe`);
});

test("downloads route ignores staged metadata with Windows-style nested filenames", async (t) => {
  const originalReadFileSync = fs.readFileSync.bind(fs);
  t.mock.method(
    fs,
    "readFileSync",
    (
      filePath: PathLike | number,
      options?: BufferEncoding | null | { encoding?: BufferEncoding | null; flag?: string }
    ) => {
      const normalizedPath = normalizeMockedFsPath(filePath);
      if (
        normalizedPath.endsWith("/downloads/latest.json") ||
        normalizedPath.endsWith("/downloads/latest-windows.json")
      ) {
        return JSON.stringify({
          version: "0.1.0",
          file: "..\\RearvyUserSetup-x64.exe",
          versionedFile: "nested\\RearvyUserSetup-x64-0.1.0.exe",
        });
      }

      return originalReadFileSync(filePath as never, options as never);
    }
  );

  const response = await GET(
    makeRequest("/downloads/latest.json"),
    makeContext(["latest.json"])
  );

  const packageVersion = getPackageVersion();
  const payload = await response.json() as { version?: string; file?: string; versionedFile?: string };

  assert.equal(response.status, 200);
  assert.equal(payload.version, packageVersion);
  assert.equal(payload.file, "RearvyUserSetup-x64.exe");
  assert.equal(payload.versionedFile, `RearvyUserSetup-x64-${packageVersion}.exe`);
});

test("downloads route serves blockmap files", async (t) => {
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);

  t.mock.method(fs, "existsSync", (filePath: PathLike) => {
    const normalizedPath = normalizeMockedFsPath(filePath);
    if (normalizedPath.endsWith(".blockmap")) {
      return true;
    }
    return originalExistsSync(filePath);
  });

  t.mock.method(fs, "readFileSync", (filePath: PathLike | number, options?: any) => {
    const normalizedPath = normalizeMockedFsPath(filePath);
    if (normalizedPath.endsWith(".blockmap")) {
      return Buffer.from("mock-blockmap-content");
    }
    return originalReadFileSync(filePath as any, options);
  });

  const response = await GET(
    makeRequest("/downloads/RearvyUserSetup-x64.exe.blockmap"),
    makeContext(["RearvyUserSetup-x64.exe.blockmap"])
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal((await response.arrayBuffer()).byteLength > 0, true);
});

test("downloads route redirects installer files to GitHub releases", async () => {
  const response = await GET(
    makeRequest("/downloads/RearvyUserSetup-x64.exe"),
    makeContext(["RearvyUserSetup-x64.exe"])
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/RearvyUserSetup-x64.exe"
  );
});

test("downloads route redirects versioned installer files to the matching release", async () => {
  const response = await GET(
    makeRequest(`/downloads/${latestMetadata.versionedFile}`),
    makeContext([latestMetadata.versionedFile])
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    `https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/download/v${latestMetadata.version}/${latestMetadata.versionedFile}`
  );
});

test("downloads route redirects macOS installer files to GitHub releases", async () => {
  const packageVersion = getPackageVersion();

  const stableResponse = await GET(
    makeRequest("/downloads/Rearvy-mac-universal.dmg"),
    makeContext(["Rearvy-mac-universal.dmg"])
  );
  assert.equal(stableResponse.status, 302);
  assert.equal(
    stableResponse.headers.get("location"),
    "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/Rearvy-mac-universal.dmg"
  );

  const versionedResponse = await GET(
    makeRequest(`/downloads/Rearvy-mac-universal-${packageVersion}.dmg`),
    makeContext([`Rearvy-mac-universal-${packageVersion}.dmg`])
  );
  assert.equal(versionedResponse.status, 302);
  assert.equal(
    versionedResponse.headers.get("location"),
    `https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/download/v${packageVersion}/Rearvy-mac-universal-${packageVersion}.dmg`
  );
});

test("downloads route redirects macOS update companion zip files", async () => {
  const packageVersion = getPackageVersion();
  const response = await GET(
    makeRequest(`/downloads/Rearvy-mac-universal-${packageVersion}.zip`),
    makeContext([`Rearvy-mac-universal-${packageVersion}.zip`])
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    `https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/download/v${packageVersion}/Rearvy-mac-universal-${packageVersion}.zip`
  );
});

test("downloads route rejects unknown installer files", async () => {
  const response = await GET(
    makeRequest("/downloads/RearvyUserSetup-arm64.exe"),
    makeContext(["RearvyUserSetup-arm64.exe"])
  );

  assert.equal(response.status, 404);
});

test("downloads route rejects unknown macOS installer files", async () => {
  const response = await GET(
    makeRequest("/downloads/Rearvy-mac-arm64.dmg"),
    makeContext(["Rearvy-mac-arm64.dmg"])
  );

  assert.equal(response.status, 404);
});

test("downloads route rejects nested local file paths", async () => {
  const response = await GET(
    makeRequest("/downloads/../latest.yml"),
    makeContext(["..", "latest.yml"])
  );

  assert.equal(response.status, 404);
});

test("downloads route rejects Windows-style nested local file paths", async () => {
  const response = await GET(
    makeRequest("/downloads/..%5Clatest.yml"),
    makeContext(["..\\latest.yml"])
  );

  assert.equal(response.status, 404);
});
