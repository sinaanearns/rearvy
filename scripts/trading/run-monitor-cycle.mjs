import { existsSync, readFileSync } from "node:fs";
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

loadEnvFile(resolve(process.cwd(), ".env.local"));

const appUrl = process.env.TRADING_RUN_CYCLE_APP_URL || "http://localhost:3000";
const token = process.env.INTERNAL_API_SECRET;

if (!appUrl || !token) {
  console.error("Missing REARVY_APP_URL or INTERNAL_API_SECRET.");
  process.exit(1);
}

const endpoint = `${appUrl.replace(/\/$/, "")}/api/internal/trading/monitor-jobs`;

async function runCycle() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": token,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`Monitor cycle failed (${response.status}): ${text}`);
    process.exit(1);
  }

  console.log(`Monitor cycle success (${response.status})`);
  console.log(text);
}

runCycle().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Request failed: ${message}`);
  process.exit(1);
});
