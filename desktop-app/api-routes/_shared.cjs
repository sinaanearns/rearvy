/* eslint-disable @typescript-eslint/no-require-imports */
const admin = require("firebase-admin");
const { createCipheriv, createHmac, createHash, randomBytes, timingSafeEqual } = require("crypto");

const SHOPIFY_DOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;
const ALGORITHM = "aes-256-gcm";

let adminInstance = null;

function normalizeRawEnvValue(value) {
  const trimmed = String(value || "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolveFirebaseProjectId(serviceAccountProjectId) {
  const candidates = [
    process.env.FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT,
    serviceAccountProjectId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function parseServiceAccountEnv(rawValue) {
  const normalizedValue = normalizeRawEnvValue(rawValue);
  const candidateValues = [normalizedValue];

  try {
    const decoded = Buffer.from(normalizedValue, "base64").toString("utf8");
    if (decoded && decoded !== normalizedValue && decoded.trim().startsWith("{")) {
      candidateValues.push(decoded.trim());
    }
  } catch {}

  for (const candidate of candidateValues) {
    try {
      const parsedInitial = JSON.parse(candidate);
      const parsed = typeof parsedInitial === "string" ? JSON.parse(parsedInitial) : parsedInitial;

      const privateKey = typeof parsed.privateKey === "string"
        ? parsed.privateKey
        : typeof parsed.private_key === "string"
          ? parsed.private_key
          : undefined;

      const projectId = typeof parsed.projectId === "string"
        ? parsed.projectId
        : typeof parsed.project_id === "string"
          ? parsed.project_id
          : undefined;

      const clientEmail = typeof parsed.clientEmail === "string"
        ? parsed.clientEmail
        : typeof parsed.client_email === "string"
          ? parsed.client_email
          : undefined;

      if (!privateKey || !projectId || !clientEmail) {
        continue;
      }

      return {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      };
    } catch {}
  }

  return null;
}

function resolveServiceAccount() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return parseServiceAccountEnv(candidate);
    }
  }

  return null;
}

function initializeAdmin() {
  if (adminInstance) {
    return adminInstance;
  }

  if (!admin.apps.length) {
    const serviceAccount = resolveServiceAccount();
    const projectId = resolveFirebaseProjectId(serviceAccount?.projectId);

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else {
      admin.initializeApp({ projectId });
    }
  }

  adminInstance = {
    adminDb: admin.firestore(),
    adminAuth: admin.auth(),
  };

  return adminInstance;
}

function getAdminDb() {
  return initializeAdmin().adminDb;
}

function getAdminAuth() {
  return initializeAdmin().adminAuth;
}

function normalizeShopifyDomain(raw) {
  const trimmed = String(raw || "").trim().toLowerCase();
  if (!trimmed) return null;

  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  const hostOnly = noProtocol.split("/")[0];
  const normalized = hostOnly.endsWith(".myshopify.com") ? hostOnly : `${hostOnly}.myshopify.com`;

  if (!SHOPIFY_DOMAIN_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
}

function isRecentShopifyTimestamp(timestamp, maxAgeSeconds = 300) {
  if (!timestamp) return false;
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - parsed) <= maxAgeSeconds;
}

function safeCompare(a, b) {
  const aBuf = Buffer.from(String(a), "utf8");
  const bBuf = Buffer.from(String(b), "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function verifyShopifyOAuthHmac(searchParams, apiSecret) {
  const providedHmac = searchParams.get("hmac");
  if (!providedHmac) return false;

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");
  return safeCompare(digest, providedHmac.toLowerCase());
}

function encryptionKey() {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not set");
  }
  return Buffer.from(key, "hex");
}

function encrypt(text) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encrypted: `${encrypted}:${authTag}`, iv: iv.toString("hex") };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  const parts = String(cookieHeader || "").split(/;\s*/);

  for (const part of parts) {
    if (!part) continue;
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = decodeURIComponent(part.slice(0, index).trim());
    const value = decodeURIComponent(part.slice(index + 1).trim());
    cookies[key] = value;
  }

  return cookies;
}

function getLocalServerOrigin(req) {
  const host = req.get("host") || `localhost:${process.env.REARVY_LOCAL_API_PORT || 4000}`;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

function getDesktopUiOrigin() {
  const candidates = [
    process.env.REARVY_DESKTOP_UI_ORIGIN,
    process.env.REARVY_DESKTOP_APP_URL,
    process.env.REARVY_DESKTOP_DEV_URL,
    "http://localhost:3000",
  ];

  for (const candidate of candidates) {
    try {
      if (!candidate) {
        continue;
      }

      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // Ignore invalid or non-HTTP(S) origins and continue with the next candidate.
    }
  }

  return "http://localhost:3000";
}

function setOAuthCookies(res, prefix, state, userId) {
  const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 600000,
  };

  res.cookie(`${prefix}_state`, state, cookieOptions);
  res.cookie(`${prefix}_uid`, userId, cookieOptions);
}

function clearOAuthCookies(res, prefix) {
  const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  };

  res.clearCookie(`${prefix}_state`, cookieOptions);
  res.clearCookie(`${prefix}_uid`, cookieOptions);
}

module.exports = {
  getAdminDb,
  getAdminAuth,
  normalizeShopifyDomain,
  isRecentShopifyTimestamp,
  verifyShopifyOAuthHmac,
  encrypt,
  parseCookies,
  getLocalServerOrigin,
  getDesktopUiOrigin,
  setOAuthCookies,
  clearOAuthCookies,
};