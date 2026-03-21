import type { Firestore } from "firebase-admin/firestore";
import { decrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";
import { runFullSync as runShopifyFullSync } from "@/lib/integrations/shopify/sync";
import { runFullSync as runYouTubeFullSync } from "@/lib/integrations/youtube/sync";
import { runFullSync as runInstagramFullSync } from "@/lib/integrations/instagram/sync";
import { runFullSync as runGA4FullSync } from "@/lib/integrations/google-analytics/sync";
import {
  checkRequiredTables,
  getYouTubeSchemaHealth,
  getInstagramSchemaHealth,
  getFacebookSchemaHealth,
} from "@/lib/integrations/schema-health";
import { runFullSync as runFacebookFullSync } from "@/lib/integrations/facebook/sync";
import { getUserPages as getFacebookPages } from "@/lib/integrations/facebook/client";

export type SyncProvider = "shopify" | "youtube" | "instagram" | "facebook" | "google_analytics";

type SyncJobRow = {
  id: string;
  user_id: string;
  integration_id: string;
  provider: SyncProvider;
  status: "pending" | "processing" | "succeeded" | "failed";
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
};

type RunJobsOptions = {
  userId?: string;
  provider?: SyncProvider;
  limit?: number;
};

type RunJobsResult = {
  processed: number;
  succeeded: number;
  failed: number;
  skippedReason?: string;
};

function isAuthFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("invalid_grant") ||
    lower.includes("oauthexception") ||
    lower.includes("token refresh failed") ||
    lower.includes("token expired") ||
    lower.includes("code\":190")
  );
}

export async function enqueueSyncJob(
  adminDb: Firestore,
  params: {
    userId: string;
    integrationId: string;
    provider: SyncProvider;
    maxAttempts?: number;
  }
) {
  try {
    await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .doc(`${params.integrationId}_${params.provider}`)
      .set({
        id: `${params.integrationId}_${params.provider}`,
        user_id: params.userId,
        integration_id: params.integrationId,
        provider: params.provider,
        status: "pending",
        attempt_count: 0,
        max_attempts: params.maxAttempts || 5,
        next_retry_at: new Date().toISOString(),
        last_error: null,
      }, { merge: true });
  } catch (error) {
    throw new Error(`Failed to enqueue sync job: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function triggerSyncWorker(provider?: SyncProvider) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const workerSecret = process.env.SYNC_WORKER_SECRET;
  if (!appUrl || !workerSecret) return;

  const url = new URL("/api/internal/sync-jobs/run", appUrl);
  if (provider) {
    url.searchParams.set("provider", provider);
  }

  try {
    await fetch(url.toString(), {
      method: "POST",
      headers: { "x-sync-worker-secret": workerSecret },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Failed to trigger sync worker:", error);
  }
}

async function processShopifyJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const integrationRef = adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(job.integration_id);
  const integrationSnap = await integrationRef.get();
  const integration = integrationSnap.data() as any;

  if (!integration) {
    throw new Error("Shopify integration not found for sync job");
  }

  const rawDomain = integration.sync_cursor?.shop_domain;
  const fallbackDomain = integration.provider_account_name
    ?.match(/\(([^)]+)\)/)?.[1];
  const shopDomain = normalizeShopifyDomain(rawDomain || fallbackDomain || "");

  if (!shopDomain) {
    throw new Error("Shopify sync job missing valid shop domain");
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  await runShopifyFullSync(adminDb, job.user_id, job.integration_id, {
    shopDomain,
    accessToken,
  });
}

async function processYouTubeJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const schemaHealth = await getYouTubeSchemaHealth(adminDb);
  if (!schemaHealth.ok) {
    throw new Error(
      `YOUTUBE_SCHEMA_MISSING:${schemaHealth.missingTables.join(",")}`
    );
  }

  const integrationRef = adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(job.integration_id);
  const integrationSnap = await integrationRef.get();
  const integration = integrationSnap.data() as any;

  if (!integration) {
    throw new Error("YouTube integration not found for sync job");
  }

  const refreshIv = integration.sync_cursor?.refresh_iv;

  if (!integration.refresh_token_enc || !refreshIv) {
    throw new Error("YouTube sync job missing refresh token");
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
  const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

  await runYouTubeFullSync(adminDb, job.user_id, job.integration_id, {
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });
}

async function processInstagramJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const schemaHealth = await getInstagramSchemaHealth(adminDb);
  if (!schemaHealth.ok) {
    throw new Error(
      `INSTAGRAM_SCHEMA_MISSING:${schemaHealth.missingTables.join(",")}`
    );
  }

  const integrationRef = adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(job.integration_id);
  const integrationSnap = await integrationRef.get();
  const integration = integrationSnap.data() as any;

  if (!integration) {
    throw new Error("Instagram integration not found for sync job");
  }

  const igUserId = integration.sync_cursor?.ig_user_id;

  if (!igUserId) {
    throw new Error("Instagram sync job missing IG user ID");
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

  await runInstagramFullSync(adminDb, job.user_id, job.integration_id, {
    accessToken,
    tokenExpiresAt,
  }, igUserId);
}

async function processFacebookJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const schemaHealth = await getFacebookSchemaHealth(adminDb);
  if (!schemaHealth.ok) {
    throw new Error(
      `FACEBOOK_SCHEMA_MISSING:${schemaHealth.missingTables.join(",")}`
    );
  }

  const integrationRef = adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(job.integration_id);
  const integrationSnap = await integrationRef.get();
  const integration = integrationSnap.data() as any;

  if (!integration) {
    throw new Error("Facebook integration not found for sync job");
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const config = {
    accessToken,
    tokenExpiresAt: new Date(integration.token_expires_at || Date.now()),
  };
  
  const pages = await getFacebookPages(config);
  await runFacebookFullSync(adminDb, job.user_id, job.integration_id, config, pages);
}

async function processGA4Job(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const integrationRef = adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(job.integration_id);
  const integrationSnap = await integrationRef.get();
  const integration = integrationSnap.data() as any;

  if (!integration) {
    throw new Error("Google Analytics integration not found for sync job");
  }

  const refreshIv = integration.sync_cursor?.refresh_iv;

  if (!integration.refresh_token_enc || !refreshIv) {
    throw new Error("Google Analytics sync job missing refresh token");
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
  const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

  await runGA4FullSync(adminDb, job.user_id, job.integration_id, {
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });
}

async function processJob(adminDb: Firestore, job: SyncJobRow) {
  if (job.provider === "shopify") {
    await processShopifyJob(adminDb, job);
    return;
  }

  if (job.provider === "youtube") {
    await processYouTubeJob(adminDb, job);
    return;
  }

  if (job.provider === "instagram") {
    await processInstagramJob(adminDb, job);
    return;
  }

  if (job.provider === "google_analytics") {
    await processGA4Job(adminDb, job);
    return;
  }

  if (job.provider === "facebook") {
    await processFacebookJob(adminDb, job);
    return;
  }

  throw new Error(`Unsupported sync job provider: ${job.provider}`);
}

export async function runPendingSyncJobs(
  adminDb: Firestore,
  options: RunJobsOptions = {}
): Promise<RunJobsResult> {
  const queueHealth = await checkRequiredTables(adminDb, [
    "integration_sync_jobs",
  ]);

  if (!queueHealth.ok) {
    if (queueHealth.missingTables.includes("integration_sync_jobs")) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skippedReason: "integration_sync_jobs table is missing",
      };
    }

    throw new Error(
      `Failed queue schema check: ${Object.values(queueHealth.errors).join("; ")}`
    );
  }

  const nowIso = new Date().toISOString();
  const limit = Math.min(Math.max(options.limit || 3, 1), 20);

  let query = adminDb
    .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
    .where("status", "in", ["pending", "failed"])
    .where("next_retry_at", "<=", nowIso)
    .orderBy("next_retry_at", "asc")
    .orderBy("created_at", "asc")
    .limit(limit);

  if (options.userId) {
    query = query.where("user_id", "==", options.userId);
  }

  if (options.provider) {
    query = query.where("provider", "==", options.provider);
  }

  const snapshot = await query.get();
  const jobs = snapshot.docs.map((doc) => doc.data() as SyncJobRow);

  if (!jobs || jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const nextAttempt = job.attempt_count + 1;
    const jobRef = adminDb.collection(COLLECTIONS.INTEGRATION_SYNC_JOBS).doc(job.id);

    try {
      // Update status to processing
      await jobRef.update({
        status: "processing",
        attempt_count: nextAttempt,
        next_retry_at: nowIso,
        last_error: null,
      });

      await processJob(adminDb, {
        ...job,
        attempt_count: nextAttempt,
      } as SyncJobRow);

      // Mark as succeeded
      await jobRef.update({
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });
      succeeded++;
    } catch (error) {
      failed++;

      const message =
        error instanceof Error ? error.message : "Unknown sync failure";
      const isSchemaError =
        (job.provider === "youtube" &&
          message.startsWith("YOUTUBE_SCHEMA_MISSING")) ||
        (job.provider === "instagram" &&
          message.startsWith("INSTAGRAM_SCHEMA_MISSING")) ||
        (job.provider === "facebook" &&
          message.startsWith("FACEBOOK_SCHEMA_MISSING"));

      if (isSchemaError) {
        await adminDb
          .collection(COLLECTIONS.INTEGRATIONS)
          .doc(job.integration_id)
          .update({ status: "error" });
      }

      if (isAuthFailure(message)) {
        await adminDb
          .collection(COLLECTIONS.INTEGRATIONS)
          .doc(job.integration_id)
          .update({ status: "expired" });
      }

      const retryable = job.attempt_count < job.max_attempts;
      const delayMinutes = Math.min(
        2 ** Math.max(job.attempt_count - 1, 0),
        60
      );
      const nextRetryAt = retryable
        ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        : null;

      await jobRef.update({
        status: "failed",
        last_error: message.slice(0, 1000),
        next_retry_at: nextRetryAt,
      });
    }
  }

  return {
    processed: jobs.length,
    succeeded,
    failed,
  };
}
