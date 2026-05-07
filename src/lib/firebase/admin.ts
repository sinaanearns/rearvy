import * as admin from "firebase-admin";
import { resolveFirebaseStorageBucketName } from "@/lib/firebase/storage-bucket";

function normalizeRawEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolveFirebaseProjectId(serviceAccountProjectId?: string) {
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

function resolveServiceAccountEnvRawValue() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeRawEnvValue(candidate);
    }
  }

  return undefined;
}

function resolveServiceAccountFromSplitEnv(): admin.ServiceAccount | null {
  const projectId = resolveFirebaseProjectId();
  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL?.trim() ||
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() ||
    process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKeyRaw =
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  const privateKey = normalizeRawEnvValue(privateKeyRaw).replace(/\\n/g, "\n");

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function escapeMultilinePrivateKey(rawValue: string): string {
  // Handle both snake_case and camelCase private_key field names
  return rawValue
    .replace(
      /"private_key"\s*:\s*"([\s\S]*?)"/,
      (_match, privateKey: string) =>
        `"private_key":"${privateKey.replace(/\r?\n/g, "\\n")}"`
    )
    .replace(
      /"privateKey"\s*:\s*"([\s\S]*?)"/,
      (_match, privateKey: string) =>
        `"privateKey":"${privateKey.replace(/\r?\n/g, "\\n")}"`
    );
}

function parseServiceAccountEnv(rawValue: string): admin.ServiceAccount {
  const normalizedValue = normalizeRawEnvValue(rawValue);
  const candidateValues = [normalizedValue];

  try {
    const decoded = Buffer.from(normalizedValue, "base64").toString("utf8");
    if (decoded && decoded !== normalizedValue && decoded.trim().startsWith("{")) {
      candidateValues.push(decoded.trim());
    }
  } catch {
    // Ignore base64 decode failures and fall back to the raw env value.
  }

  let lastError: unknown = null;

  for (const candidate of candidateValues) {
    for (const variant of [candidate, escapeMultilinePrivateKey(candidate)]) {
      try {
        const parsedInitial = JSON.parse(variant) as unknown;
        const parsed =
          typeof parsedInitial === "string"
            ? (JSON.parse(parsedInitial) as Record<string, unknown>)
            : (parsedInitial as Record<string, unknown>);
        const privateKey =
          typeof parsed.privateKey === "string"
            ? parsed.privateKey
            : typeof parsed.private_key === "string"
              ? parsed.private_key
              : undefined;

        if (!privateKey) {
          throw new Error("Missing or invalid private key field");
        }

        const projectId =
          typeof parsed.projectId === "string"
            ? parsed.projectId
            : typeof parsed.project_id === "string"
              ? parsed.project_id
              : undefined;

        const clientEmail =
          typeof parsed.clientEmail === "string"
            ? parsed.clientEmail
            : typeof parsed.client_email === "string"
              ? parsed.client_email
              : undefined;

        if (!projectId || !clientEmail) {
          throw new Error(
            `Missing required fields: projectId=${!!projectId}, clientEmail=${!!clientEmail}`
          );
        }

        return {
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT", {
    lastError: lastError instanceof Error ? lastError.message : String(lastError),
    sampleLength: normalizedValue.length,
  });

  throw lastError instanceof Error
    ? lastError
    : new Error("Invalid FIREBASE_SERVICE_ACCOUNT value.");
}

// Initialize Firebase Admin SDK (singleton)
const configuredStorageBucket = resolveFirebaseStorageBucketName();
const serviceAccountEnv = resolveServiceAccountEnvRawValue();
const splitEnvServiceAccount = resolveServiceAccountFromSplitEnv();

if (!admin.apps.length) {
  if (serviceAccountEnv || splitEnvServiceAccount) {
    try {
      const serviceAccount = splitEnvServiceAccount ?? parseServiceAccountEnv(serviceAccountEnv as string);
      const projectId = resolveFirebaseProjectId(serviceAccount.projectId);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
        storageBucket: configuredStorageBucket || undefined,
      });
    } catch (error) {
      console.error(
        "Failed to initialize Firebase Admin from explicit credentials; falling back to default credentials",
        error instanceof Error ? error.message : String(error)
      );

      const projectId = resolveFirebaseProjectId();
      // Fall back to default initialization (ADC / emulator) instead of throwing
      admin.initializeApp({
        projectId,
        storageBucket: configuredStorageBucket || undefined,
      });
    }
  } else {
    const projectId = resolveFirebaseProjectId();
    // Development: use application default credentials or emulator
    admin.initializeApp({
      projectId,
      storageBucket: configuredStorageBucket || undefined,
    });

    if (process.env.NODE_ENV === "production") {
      console.error(
        "Firebase Admin initialized without explicit service account. Set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT_JSON)."
      );
    }
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();

export default admin;
