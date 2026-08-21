import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    if (!key) {
      continue;
    }

    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function shellEscape(value) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function resolveGcloudCommand() {
  const explicit = process.env.GCLOUD_CMD;
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const fallback = `${localAppData}\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd`;
  if (localAppData && existsSync(fallback)) {
    return fallback;
  }

  return "gcloud";
}

function run(command) {
  return execSync(command, { stdio: "pipe" }).toString("utf8").trim();
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountRaw) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT in .env.local");
  process.exit(1);
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Missing GOOGLE_CLOUD_PROJECT and NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
  process.exit(1);
}

const gcloud = resolveGcloudCommand();
const keyPath = resolve(process.cwd(), ".tmp-gcloud-key.json");

try {
  const parsed = JSON.parse(serviceAccountRaw);
  writeFileSync(keyPath, JSON.stringify(parsed, null, 2), "utf8");

  run(`${shellEscape(gcloud)} auth activate-service-account --key-file=${shellEscape(keyPath)}`);
  run(`${shellEscape(gcloud)} config set project ${shellEscape(projectId)}`);

  console.log("gcloud authenticated with service account from .env.local");
  console.log(`project: ${projectId}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to authenticate gcloud: ${message}`);
  process.exit(1);
} finally {
  try {
    rmSync(keyPath, { force: true });
  } catch {
    // best effort cleanup
  }
}
