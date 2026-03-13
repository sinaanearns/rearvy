import * as admin from "firebase-admin";

function escapeMultilinePrivateKey(rawValue: string): string {
  return rawValue.replace(
    /"private_key"\s*:\s*"([\s\S]*?)"/,
    (_match, privateKey: string) =>
      `"private_key":"${privateKey.replace(/\r?\n/g, "\\n")}"`
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

        return {
          projectId:
            typeof parsed.projectId === "string"
              ? parsed.projectId
              : typeof parsed.project_id === "string"
                ? parsed.project_id
                : undefined,
          clientEmail:
            typeof parsed.clientEmail === "string"
              ? parsed.clientEmail
              : typeof parsed.client_email === "string"
                ? parsed.client_email
                : undefined,
          privateKey:
            typeof privateKey === "string"
              ? privateKey.replace(/\\n/g, "\n")
              : undefined,
        };
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Invalid FIREBASE_SERVICE_ACCOUNT value.");
}

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
  // Check if running in production with service account
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = parseServiceAccountEnv(
      process.env.FIREBASE_SERVICE_ACCOUNT
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    // Development: use application default credentials or emulator
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
