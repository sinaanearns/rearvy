import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDesktopReleaseVersions } from "./assert-release-versions.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const desktopDir = path.join(rootDir, "desktop-app");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const releaseDir = path.join(rootDir, "desktop-release", stamp);
const builderBin = path.join(
  desktopDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);

function loadDotEnvLocal() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const blockedKeys = new Set(["NODE_ENV", "BABEL_ENV"]);
  const raw = fs.readFileSync(envPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!key || blockedKeys.has(key) || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || rootDir,
      env: {
        ...(options.env || process.env),
        ELECTRON_RUN_AS_NODE: "",
      },
      shell: false,
      stdio: "inherit",
      windowsHide: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function removeDirectoryIfExists(directoryPath) {
  fs.rmSync(directoryPath, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
}

async function buildDesktopWebsiteBundle() {
  const nextDir = path.join(rootDir, "website", ".next");
  if (path.relative(path.join(rootDir, "website"), nextDir).startsWith("..")) {
    throw new Error(`Refusing to clean unexpected Next build path: ${nextDir}`);
  }

  removeDirectoryIfExists(nextDir);

  console.log("Building website bundle for the macOS desktop app...");
  await run("npm", ["run", "build"], {
    cwd: path.join(rootDir, "website"),
    env: {
      ...process.env,
      NEXT_PUBLIC_DESKTOP_BUILD: "true",
    },
  });

  const tracedDownloadsDir = path.join(
    rootDir,
    "website",
    ".next",
    "standalone",
    "website",
    "public",
    "downloads"
  );

  if (fs.existsSync(tracedDownloadsDir)) {
    removeDirectoryIfExists(tracedDownloadsDir);
  }
}

function isMacSigningRequired() {
  return /^(1|true|yes)$/i.test(process.env.REARVY_REQUIRE_MAC_SIGNING || "");
}

function hasMacSigningConfiguration() {
  return Boolean(
    process.env.CSC_LINK ||
      process.env.CSC_NAME ||
      process.env.APPLE_ID ||
      process.env.APPLE_API_KEY ||
      process.env.APPLE_API_KEY_ID
  );
}

function getBuilderEnv() {
  const env = { ...process.env };

  if (!hasMacSigningConfiguration()) {
    env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  }

  return env;
}

loadDotEnvLocal();
assertDesktopReleaseVersions(rootDir);

if (process.platform !== "darwin") {
  throw new Error(
    "macOS desktop builds must run on macOS. Use a Mac machine or a macOS GitHub Actions runner to produce the DMG/ZIP artifacts."
  );
}

if (isMacSigningRequired() && !hasMacSigningConfiguration()) {
  throw new Error(
    "REARVY_REQUIRE_MAC_SIGNING is enabled, but no macOS signing/notarization credentials are configured."
  );
}

console.log(`Building macOS universal desktop app in ${releaseDir}`);
await buildDesktopWebsiteBundle();

const args = [
  "--publish",
  "never",
  "--mac",
  "dmg",
  "zip",
  "--universal",
  `--config.directories.output=${releaseDir}`,
];

if (!hasMacSigningConfiguration()) {
  args.push("--config.mac.identity=null");
  console.log("No macOS signing credentials configured; building unsigned local artifacts.");
}

await run(builderBin, args, {
  cwd: desktopDir,
  env: getBuilderEnv(),
});

await run(process.execPath, ["scripts/post-desktop-build.mjs"], {
  cwd: rootDir,
  env: {
    ...process.env,
    DESKTOP_RELEASE_DIR: releaseDir,
    REARVY_DESKTOP_PLATFORM: "mac",
  },
});
