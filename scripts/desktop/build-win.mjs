import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const desktopDir = path.join(rootDir, "desktop-app");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const releaseDir = path.join(rootDir, "desktop-release", stamp);
const desktopPackageJson = JSON.parse(
  fs.readFileSync(path.join(desktopDir, "package.json"), "utf8")
);
const productName = desktopPackageJson.build?.productName || "Rearvy";
const version = desktopPackageJson.version;
const versionedInstallerName = `${productName}UserSetup-x64-${version}.exe`;
const builderBin = path.join(
  desktopDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder"
);
const appBuilderBin = path.join(
  desktopDir,
  "node_modules",
  "app-builder-bin",
  process.platform === "win32" ? path.join("win", "x64", "app-builder.exe") : "app-builder"
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

    if (!key || blockedKeys.has(key)) {
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const useWindowsCmdWrapper = process.platform === "win32" && /(?:^|\\|\/)(?:npm\.cmd|electron-builder\.cmd)$/i.test(command);
    const quoteWindowsArg = (value) => {
      const text = String(value);
      if (!/[\s"^&|<>]/.test(text)) {
        return text;
      }

      return `"${text.replaceAll('"', '\\"')}"`;
    };
    const wrappedCommand = useWindowsCmdWrapper
      ? [command, ...args].map(quoteWindowsArg).join(" ")
      : args;
    const child = spawn(
      useWindowsCmdWrapper ? "cmd.exe" : command,
      useWindowsCmdWrapper ? ["/d", "/s", "/c", wrappedCommand] : wrappedCommand,
      {
      cwd: options.cwd || rootDir,
      env: {
        ...(options.env || process.env),
        ELECTRON_RUN_AS_NODE: "",
      },
      shell: false,
      stdio: "inherit",
      windowsHide: false,
      }
    );

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

function getSigningCertificatePath() {
  const link = process.env.WIN_CSC_LINK || process.env.CSC_LINK;
  if (!link) {
    return null;
  }

  if (link.startsWith("file://")) {
    return decodeURIComponent(link.slice("file://".length));
  }

  if (/^[A-Za-z]:[\\/]/.test(link) || link.startsWith("\\\\")) {
    return link;
  }

  const tempCertPath = path.join(releaseDir, "rearvy-signing-cert.pfx");
  fs.writeFileSync(tempCertPath, Buffer.from(link, "base64"));
  return tempCertPath;
}

function getUnsignedBuilderEnv() {
  const env = { ...process.env };

  // electron-builder attempts signing if these are present, even when
  // signAndEditExecutable=false is set.
  delete env.WIN_CSC_LINK;
  delete env.CSC_LINK;
  delete env.WIN_CSC_KEY_PASSWORD;
  delete env.CSC_KEY_PASSWORD;
  delete env.CSC_KEY_PASSWORD_FILE;
  delete env.CSC_NAME;

  return env;
}

async function signWindowsFile(filePath) {
  const certificatePath = getSigningCertificatePath();
  const password = process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD;

  if (!certificatePath || !password) {
    throw new Error("Windows signing requires WIN_CSC_LINK/CSC_LINK and WIN_CSC_KEY_PASSWORD/CSC_KEY_PASSWORD.");
  }

  if (!fs.existsSync(certificatePath)) {
    throw new Error(`Windows signing certificate does not exist: ${certificatePath}`);
  }

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($env:REARVY_SIGN_CERT, $env:REARVY_SIGN_PASSWORD, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)",
    "$result = Set-AuthenticodeSignature -FilePath $env:REARVY_SIGN_TARGET -Certificate $cert -TimestampServer 'http://timestamp.digicert.com'",
    "if ($result.Status -ne 'Valid') { throw \"Signing failed for $env:REARVY_SIGN_TARGET: $($result.Status) $($result.StatusMessage)\" }",
  ].join("; ");

  console.log(`Signing ${filePath}`);
  await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    cwd: rootDir,
    env: {
      ...process.env,
      REARVY_SIGN_CERT: certificatePath,
      REARVY_SIGN_PASSWORD: password,
      REARVY_SIGN_TARGET: filePath,
    },
  });
}

async function regenerateBlockmap(filePath) {
  console.log(`Regenerating blockmap for ${filePath}`);
  await run(appBuilderBin, [
    "blockmap",
    "--input",
    filePath,
    "--output",
    `${filePath}.blockmap`,
    "--compression",
    "deflate",
  ]);
}

async function buildDesktopWebsiteBundle() {
  console.log("Building website bundle for the desktop app...");
  await run(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    {
      cwd: path.join(rootDir, "website"),
      env: {
        ...process.env,
        NEXT_PUBLIC_DESKTOP_BUILD: "true",
      },
    }
  );
}

async function prepareAutomatonRuntime() {
  console.log("Preparing Automaton runtime for the desktop app...");
  await run(process.execPath, ["scripts/desktop/prepare-automaton-runtime.mjs"], {
    cwd: rootDir,
  });
}

loadDotEnvLocal();

console.log(`Building Windows installer in ${releaseDir}`);
await buildDesktopWebsiteBundle();
await prepareAutomatonRuntime();

const signingCertificatePath = getSigningCertificatePath();
const signingPassword = process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD;
const hasSigningCredentials = Boolean(signingCertificatePath && signingPassword);
const hasSigningCertificate = Boolean(
  hasSigningCredentials && signingCertificatePath && fs.existsSync(signingCertificatePath)
);

if (hasSigningCredentials && !hasSigningCertificate) {
  console.warn(
    `Windows signing certificate does not exist at ${signingCertificatePath}; building unsigned and skipping executable signing.`
  );
}

if (!hasSigningCertificate) {
  console.log("No Windows signing certificate configured; building unsigned and skipping executable signing/editing.");
  {
    const args = [
      "--publish",
      "never",
      "--win",
      "nsis",
      "--x64",
      `--config.directories.output=${releaseDir}`,
      "--config.compression=store",
      "--config.win.signAndEditExecutable=false",
    ];

    await run(builderBin, args, {
      cwd: desktopDir,
      env: getUnsignedBuilderEnv(),
    });
  }

  // Generate blockmap for unsigned build (required by post-desktop-build.mjs)
  const installerPath = path.join(releaseDir, versionedInstallerName);
  if (!fs.existsSync(installerPath)) {
    throw new Error(`Expected installer was not created: ${installerPath}`);
  }
  await regenerateBlockmap(installerPath);
} else {
  console.log("Windows signing certificate configured; using Windows-native signing flow.");

  {
    const args = [
      "--publish",
      "never",
      "--dir",
      `--config.directories.output=${releaseDir}`,
      "--config.compression=store",
      "--config.win.signAndEditExecutable=false",
    ];

    await run(builderBin, args, {
      cwd: desktopDir,
      env: process.env,
    });
  }

  const unpackedDir = path.join(releaseDir, "win-unpacked");
  const unpackedExe = path.join(unpackedDir, `${productName}.exe`);
  await signWindowsFile(unpackedExe);

  {
    const args = [
      "--publish",
      "never",
      "--win",
      "nsis",
      "--x64",
      `--prepackaged=${unpackedDir}`,
      `--config.directories.output=${releaseDir}`,
      "--config.compression=store",
      "--config.win.signAndEditExecutable=false",
    ];

    await run(builderBin, args, {
      cwd: desktopDir,
      env: process.env,
    });
  }

  const installerPath = path.join(releaseDir, versionedInstallerName);
  if (!fs.existsSync(installerPath)) {
    throw new Error(`Expected installer was not created: ${installerPath}`);
  }

  await signWindowsFile(installerPath);
  await regenerateBlockmap(installerPath);
}

await run(process.execPath, ["scripts/post-desktop-build.mjs"], {
  cwd: rootDir,
  env: {
    ...process.env,
    DESKTOP_RELEASE_DIR: releaseDir,
  },
});
