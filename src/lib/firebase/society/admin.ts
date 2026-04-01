import * as admin from "firebase-admin";

const SOCIETY_ADMIN_APP_NAME = "rearvy-society-admin";

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
    // Ignore base64 decode failures and fall back to raw env value.
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
    : new Error("Invalid REARVY_SOCIETY_FIREBASE_SERVICE_ACCOUNT value.");
}

function getSocietyAdminApp(): admin.app.App {
  const existingApp = admin.apps.find((app) => app.name === SOCIETY_ADMIN_APP_NAME);
  if (existingApp) {
    return existingApp;
  }

  const projectId =
    process.env.REARVY_SOCIETY_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "Missing Firebase project id. Set REARVY_SOCIETY_FIREBASE_PROJECT_ID (recommended) or NEXT_PUBLIC_FIREBASE_PROJECT_ID."
    );
  }

  const serviceAccountEnv =
    process.env.REARVY_SOCIETY_FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!process.env.REARVY_SOCIETY_FIREBASE_PROJECT_ID) {
    console.warn(
      "[rearvy-society] REARVY_SOCIETY_FIREBASE_PROJECT_ID is not set. Falling back to primary Firebase project."
    );
  }

  if (!process.env.REARVY_SOCIETY_FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.warn(
      "[rearvy-society] REARVY_SOCIETY_FIREBASE_SERVICE_ACCOUNT is not set. Falling back to FIREBASE_SERVICE_ACCOUNT."
    );
  }

  if (serviceAccountEnv) {
    const serviceAccount = parseServiceAccountEnv(serviceAccountEnv);
    return admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId,
      },
      SOCIETY_ADMIN_APP_NAME
    );
  }

  return admin.initializeApp(
    {
      projectId,
    },
    SOCIETY_ADMIN_APP_NAME
  );
}

const societyAdminApp = getSocietyAdminApp();

export const societyAdminDb = societyAdminApp.firestore();
