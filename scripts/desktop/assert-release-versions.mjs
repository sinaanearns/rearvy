#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const versionFiles = [
  {
    relativePath: "package.json",
    labels: [{ name: "version", read: (json) => json.version }],
  },
  {
    relativePath: "package-lock.json",
    labels: [
      { name: "version", read: (json) => json.version },
      { name: 'packages[""].version', read: (json) => json.packages?.[""]?.version },
    ],
  },
  {
    relativePath: path.join("website", "package.json"),
    labels: [{ name: "version", read: (json) => json.version }],
  },
  {
    relativePath: path.join("website", "package-lock.json"),
    labels: [
      { name: "version", read: (json) => json.version },
      { name: 'packages[""].version', read: (json) => json.packages?.[""]?.version },
    ],
  },
  {
    relativePath: path.join("desktop-app", "package.json"),
    labels: [{ name: "version", read: (json) => json.version }],
  },
  {
    relativePath: path.join("desktop-app", "package-lock.json"),
    labels: [
      { name: "version", read: (json) => json.version },
      { name: 'packages[""].version', read: (json) => json.packages?.[""]?.version },
    ],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function assertDesktopReleaseVersions(rootDir, options = {}) {
  const entries = [];

  for (const versionFile of versionFiles) {
    const filePath = path.join(rootDir, versionFile.relativePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Release version check failed: missing ${versionFile.relativePath}`);
    }

    const json = readJson(filePath);
    for (const label of versionFile.labels) {
      const version = label.read(json);
      if (typeof version !== "string" || version.trim() === "") {
        throw new Error(`Release version check failed: missing ${label.name} in ${versionFile.relativePath}`);
      }

      entries.push({
        source: `${versionFile.relativePath} ${label.name}`,
        version,
      });
    }
  }

  const expectedVersion = options.expectedVersion || entries[0]?.version;
  const mismatches = entries.filter((entry) => entry.version !== expectedVersion);

  if (mismatches.length > 0) {
    const details = entries
      .map((entry) => `  - ${entry.source}: ${entry.version}`)
      .join("\n");

    throw new Error(
      `Desktop release package versions must match before building.\n` +
        `Expected every source to be ${expectedVersion}.\n` +
        `${details}\n` +
        "Bump package.json, package-lock.json, website/package.json, website/package-lock.json, " +
        "desktop-app/package.json, and desktop-app/package-lock.json together."
    );
  }

  console.log(`Desktop release version preflight OK: ${expectedVersion}`);
  return { version: expectedVersion, entries };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  assertDesktopReleaseVersions(rootDir);
}
