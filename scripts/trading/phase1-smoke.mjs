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

const appUrl = (process.env.TRADING_SMOKE_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const internalToken = process.env.INTERNAL_API_SECRET;
const configuredIdToken = process.env.TRADING_TEST_ID_TOKEN;
const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const results = [];

function report(name, status, details) {
  results.push({ name, status, details });
  const marker = status === "pass" ? "PASS" : status === "skip" ? "SKIP" : "FAIL";
  console.log(`[${marker}] ${name}${details ? ` - ${details}` : ""}`);
}

async function request(path, options = {}) {
  const url = `${appUrl}${path}`;
  return fetch(url, options);
}

async function checkInternalUnauthorized() {
  const res = await request("/api/internal/trading/monitor-jobs");
  if (res.status === 401) {
    report("internal endpoint rejects missing token", "pass", "received 401 as expected");
    return;
  }

  const text = await res.text();
  throw new Error(`expected 401, received ${res.status}: ${text}`);
}

async function checkInternalAuthorized() {
  if (!internalToken) {
    report("internal endpoint accepts valid token", "skip", "INTERNAL_API_SECRET not set");
    return;
  }

  const res = await request("/api/internal/trading/monitor-jobs", {
    headers: {
      "x-internal-token": internalToken,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`expected 200, received ${res.status}: ${text}`);
  }

  report("internal endpoint accepts valid token", "pass", "received 200");
}

async function checkAuthRequiredOnMonitorsGet() {
  const res = await request("/api/trading/monitors?chatId=phase1-smoke");
  if (res.status === 401) {
    report("trading monitors require auth", "pass", "received 401 as expected");
    return;
  }

  const text = await res.text();
  throw new Error(`expected 401, received ${res.status}: ${text}`);
}

async function createTestIdToken() {
  if (configuredIdToken) {
    return configuredIdToken;
  }

  if (!firebaseApiKey) {
    return null;
  }

  const nonce = Date.now().toString(36);
  const email = `phase1_smoke_${nonce}@rearvy.test`;
  const password = `Smoke_${nonce}_Aa1!`;

  const signupResponse = await request("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fullName: "Phase1 Smoke",
      email,
      password,
    }),
  });

  if (!signupResponse.ok) {
    const text = await signupResponse.text();
    throw new Error(`could not create smoke user (${signupResponse.status}): ${text}`);
  }

  const tokenResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`could not obtain Firebase ID token (${tokenResponse.status}): ${text}`);
  }

  const payload = await tokenResponse.json();
  if (!payload?.idToken || typeof payload.idToken !== "string") {
    throw new Error("Firebase sign-in response did not include idToken");
  }

  return payload.idToken;
}

async function checkAuthenticatedValidationPath(idToken) {
  if (!idToken) {
    report("authenticated monitor validation path", "skip", "No ID token available (set TRADING_TEST_ID_TOKEN or NEXT_PUBLIC_FIREBASE_API_KEY)");
    return;
  }

  const res = await request("/api/trading/monitors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      chatId: "phase1-smoke-chat",
      symbol: "BTC/USD",
      timeframe: "H1",
      action: "Hold",
      confidence: 0.8,
      reason: "This smoke test intentionally sends Hold to validate rejection behavior.",
    }),
  });

  if (res.status === 400) {
    report("authenticated monitor validation path", "pass", "Hold monitor creation correctly rejected");
    return;
  }

  const text = await res.text();
  throw new Error(`expected 400, received ${res.status}: ${text}`);
}

async function main() {
  console.log(`Running Phase 1 smoke checks against ${appUrl}`);

  try {
    await checkInternalUnauthorized();
    await checkInternalAuthorized();
    await checkAuthRequiredOnMonitorsGet();

    let idToken = configuredIdToken;
    if (!idToken) {
      try {
        idToken = await createTestIdToken();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        report("test user token bootstrap", "skip", message);
      }
    }

    await checkAuthenticatedValidationPath(idToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report("phase1 smoke execution", "fail", message);
  }

  const failed = results.some((entry) => entry.status === "fail");
  const passed = results.filter((entry) => entry.status === "pass").length;
  const skipped = results.filter((entry) => entry.status === "skip").length;

  console.log(`Summary: ${passed} passed, ${skipped} skipped, ${failed ? 1 : 0} failed`);

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Smoke script failed unexpectedly: ${message}`);
  process.exit(1);
});
