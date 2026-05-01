import * as admin from "firebase-admin";
import { resolveFirebaseStorageBucketName } from "@/lib/firebase/storage-bucket";

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
  const normalizedValue = rawValue.trim();
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
        const parsed = JSON.parse(variant) as Record<string, unknown>;
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

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = parseServiceAccountEnv(
        process.env.FIREBASE_SERVICE_ACCOUNT
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: configuredStorageBucket || undefined,
      });
    } catch (error) {
      console.error(
        "Failed to parse FIREBASE_SERVICE_ACCOUNT; falling back to default credentials",
        error instanceof Error ? error.message : String(error)
      );
      // Fall back to default initialization (ADC / emulator) instead of throwing
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: configuredStorageBucket || undefined,
      });
    }
  } else {
    // Development: use application default credentials or emulator
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: configuredStorageBucket || undefined,
    });
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();

export default admin;
