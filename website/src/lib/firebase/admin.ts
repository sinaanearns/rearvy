import * as admin from "firebase-admin";
import { resolveFirebaseStorageBucketName } from "@/lib/firebase/storage-bucket";
import {
  normalizeRawEnvValue,
  parseServiceAccountEnv,
} from "@/lib/firebase/service-account";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("FirebaseAdmin");

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

function initializeAdminAppSafely(optionsList: admin.AppOptions[]) {
  for (const options of optionsList) {
    try {
      admin.initializeApp(options);
      return true;
    } catch (error) {
      log.error("Firebase Admin initializeApp attempt failed", {
        hasCredential: Boolean(options.credential),
        hasProjectId: Boolean(options.projectId),
        hasStorageBucket: Boolean(options.storageBucket),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return false;
}

// Initialize Firebase Admin SDK (singleton)
const configuredStorageBucket = resolveFirebaseStorageBucketName();
const serviceAccountEnv = resolveServiceAccountEnvRawValue();
const splitEnvServiceAccount = resolveServiceAccountFromSplitEnv();

if (!admin.apps.length) {
  const projectId = resolveFirebaseProjectId();

  if (serviceAccountEnv || splitEnvServiceAccount) {
    try {
      const serviceAccount = splitEnvServiceAccount ?? parseServiceAccountEnv(serviceAccountEnv as string);
      const resolvedProjectId = resolveFirebaseProjectId(serviceAccount.projectId);
      const credential = admin.credential.cert(serviceAccount);

      const initialized = initializeAdminAppSafely([
        {
          credential,
          projectId: resolvedProjectId,
          storageBucket: configuredStorageBucket || undefined,
        },
        {
          credential,
          projectId: resolvedProjectId,
        },
        {
          credential,
        },
      ]);

      if (!initialized) {
        throw new Error("All credentialed Firebase Admin initialization attempts failed.");
      }
    } catch (error) {
      log.error(
        "Failed to initialize Firebase Admin from explicit credentials; falling back to default credentials",
        error instanceof Error ? error.message : String(error)
      );

      initializeAdminAppSafely([
        {
          projectId,
          storageBucket: configuredStorageBucket || undefined,
        },
        {
          projectId,
        },
        {
          storageBucket: configuredStorageBucket || undefined,
        },
        {},
      ]);
    }
  } else {
    initializeAdminAppSafely([
      {
        projectId,
        storageBucket: configuredStorageBucket || undefined,
      },
      {
        projectId,
      },
      {
        storageBucket: configuredStorageBucket || undefined,
      },
      {},
    ]);

    if (process.env.NODE_ENV === "production") {
      log.error(
        "Firebase Admin initialized without explicit service account. Set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT_JSON)."
      );
    }
  }

  if (!admin.apps.length) {
    admin.initializeApp({});
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();

export default admin;
