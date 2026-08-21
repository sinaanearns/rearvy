import type { Firestore } from "firebase-admin/firestore";
import { decrypt } from "@/lib/utils/encryption";
import { COLLECTIONS, type Integration } from "@/lib/firebase/schema";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";
import { runFullSync as runShopifyFullSync } from "@/lib/integrations/shopify/sync";
import { runFullSync as runYouTubeFullSync } from "@/lib/integrations/youtube/sync";
import { runFullSync as runInstagramFullSync } from "@/lib/integrations/instagram/sync";
import { runFullSync as runGA4FullSync } from "@/lib/integrations/google-analytics/sync";
import { runFullSync as runRazorpayFullSync } from "@/lib/integrations/razorpay/sync";
import {
  checkRequiredTables,
  getYouTubeSchemaHealth,
  getInstagramSchemaHealth,
  getFacebookSchemaHealth,
  getLinkedInSchemaHealth,
} from "@/lib/integrations/schema-health";
import { safeDocId } from "@/lib/firebase/doc-utils";
import { runFullSync as runFacebookFullSync } from "@/lib/integrations/facebook/sync";
import { getUserPages as getFacebookPages } from "@/lib/integrations/facebook/client";
import { runFullSync as runGmailFullSync } from "@/lib/integrations/gmail/sync";
import { runFullSync as runGitHubFullSync } from "@/lib/integrations/github/sync";
import { runFullSync as runLinkedInFullSync } from "@/lib/integrations/linkedin/sync";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("IntegrationSyncJobs");

export type SyncProvider =
  | "shopify"
  | "youtube"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "github"
  | "google_analytics"
  | "razorpay"
  | "gmail";

type SyncJobRow = {
  id: string;
  user_id: string;
  integration_id: string;
  provider: SyncProvider;
  status: "pending" | "processing" | "succeeded" | "failed";
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
    lower.includes("bad credentials") ||
    lower.includes("github api error (401)") ||
    lower.includes("github api error (403)") ||
    lower.includes("code\":190")
  );
}

function requireIntegration(
  integration: Integration | undefined,
  providerLabel: string
) {
  if (!integration) {
    throw new Error(`${providerLabel} integration not found for sync job`);
  }

  return integration;
}

async function loadIntegration(
  adminDb: Firestore,
  integrationId: string,
  providerLabel: string
) {
  const integrationSnap = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .get();

  return requireIntegration(
    integrationSnap.data() as Integration | undefined,
    providerLabel
  );
}

function getSyncCursorString(integration: Integration, key: string) {
  const syncCursor = integration.sync_cursor;
  if (!syncCursor || typeof syncCursor !== "object" || Array.isArray(syncCursor)) {
    return "";
  }

  const value = syncCursor[key];
  return typeof value === "string" ? value : "";
}

function getTokenExpiresAt(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => unknown };
    const date = maybeTimestamp.toDate?.();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date(0);
}

function decryptAccessToken(integration: Integration, providerLabel: string) {
  if (
    typeof integration.access_token_enc !== "string" ||
    !integration.access_token_enc ||
    typeof integration.token_iv !== "string" ||
    !integration.token_iv
  ) {
    throw new Error(`${providerLabel} sync job missing access token`);
  }

  return decrypt(integration.access_token_enc, integration.token_iv);
}

function decryptRefreshToken(integration: Integration, providerLabel: string) {
  const refreshIv = getSyncCursorString(integration, "refresh_iv");
  if (
    typeof integration.refresh_token_enc !== "string" ||
    !integration.refresh_token_enc ||
    !refreshIv
  ) {
    throw new Error(`${providerLabel} sync job missing refresh token`);
  }

  return decrypt(integration.refresh_token_enc, refreshIv);
}

function isGoogleApiDisabledError(provider: SyncProvider, message: string): boolean {
  const lower = message.toLowerCase();

  if (provider === "youtube") {
    return (
      lower.includes("youtube.googleapis.com") &&
      (lower.includes("service_disabled") ||
        lower.includes("accessnotconfigured") ||
        lower.includes("api has not been used in project"))
    );
  }

  if (provider === "gmail") {
    return (
      lower.includes("gmail.googleapis.com") &&
      (lower.includes("service_disabled") ||
        lower.includes("accessnotconfigured") ||
        lower.includes("api has not been used in project"))
    );
  }

  if (provider === "google_analytics") {
    return (
      (lower.includes("analyticsadmin.googleapis.com") ||
        lower.includes("analyticsdata.googleapis.com")) &&
      (lower.includes("service_disabled") ||
        lower.includes("accessnotconfigured") ||
        lower.includes("api has not been used in project"))
    );
  }

  return false;
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
    const nowIso = new Date().toISOString();
    await adminDb
      .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
      .doc(safeDocId(params.integrationId, params.provider))
      .set({
        id: safeDocId(params.integrationId, params.provider),
        user_id: params.userId,
        integration_id: params.integrationId,
        provider: params.provider,
        status: "pending",
        attempt_count: 0,
        max_attempts: params.maxAttempts || 5,
        next_retry_at: nowIso,
        last_error: null,
        created_at: nowIso,
        updated_at: nowIso,
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
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "x-sync-worker-secret": workerSecret },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      log.warn(
        `Sync worker responded with ${response.status} for ${
          provider || "all providers"
        }: ${message}`
      );
    }
  } catch (error) {
    log.error("Failed to trigger sync worker:", error);
  }
}

async function processShopifyJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const integration = await loadIntegration(adminDb, job.integration_id, "Shopify");

  const rawDomain = getSyncCursorString(integration, "shop_domain");
  const fallbackDomain = integration.provider_account_name
    ?.match(/\(([^)]+)\)/)?.[1];
  const shopDomain = normalizeShopifyDomain(rawDomain || fallbackDomain || "");

  if (!shopDomain) {
    throw new Error("Shopify sync job missing valid shop domain");
  }

  const accessToken = decryptAccessToken(integration, "Shopify");
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

  const integration = await loadIntegration(adminDb, job.integration_id, "YouTube");

  const accessToken = decryptAccessToken(integration, "YouTube");
  const refreshToken = decryptRefreshToken(integration, "YouTube");
  const tokenExpiresAt = getTokenExpiresAt(integration.token_expires_at);

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

  const integration = await loadIntegration(adminDb, job.integration_id, "Instagram");

  const igUserId = getSyncCursorString(integration, "ig_user_id");

  if (!igUserId) {
    throw new Error("Instagram sync job missing IG user ID");
  }

  const accessToken = decryptAccessToken(integration, "Instagram");
  const tokenExpiresAt = getTokenExpiresAt(integration.token_expires_at);

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

  const integration = await loadIntegration(adminDb, job.integration_id, "Facebook");

  const accessToken = decryptAccessToken(integration, "Facebook");
  const config = {
    accessToken,
    tokenExpiresAt: getTokenExpiresAt(integration.token_expires_at),
  };

  const pages = await getFacebookPages(config);
  if (pages.length === 0) {
    throw new Error("Facebook sync job found no pages to sync");
  }

  await runFacebookFullSync(adminDb, job.user_id, job.integration_id, config, pages);
}

async function processGA4Job(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const integration = await loadIntegration(
    adminDb,
    job.integration_id,
    "Google Analytics"
  );

  const accessToken = decryptAccessToken(integration, "Google Analytics");
  const refreshToken = decryptRefreshToken(integration, "Google Analytics");
  const tokenExpiresAt = getTokenExpiresAt(integration.token_expires_at);

  await runGA4FullSync(adminDb, job.user_id, job.integration_id, {
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });
}

async function processRazorpayJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  await runRazorpayFullSync(adminDb, job.user_id, job.integration_id);
}

async function processGmailJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const integration = await loadIntegration(adminDb, job.integration_id, "Gmail");

  const accessToken = decryptAccessToken(integration, "Gmail");
  const refreshToken = decryptRefreshToken(integration, "Gmail");
  const tokenExpiresAt = getTokenExpiresAt(integration.token_expires_at);

  await runGmailFullSync(adminDb, job.user_id, job.integration_id, {
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });
}

async function processGitHubJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const integration = await loadIntegration(adminDb, job.integration_id, "GitHub");

  const accessToken = decryptAccessToken(integration, "GitHub");

  await runGitHubFullSync(adminDb, job.user_id, job.integration_id, {
    accessToken,
  });
}

async function processLinkedInJob(
  adminDb: Firestore,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const schemaHealth = await getLinkedInSchemaHealth(adminDb);
  if (!schemaHealth.ok) {
    throw new Error(
      `LINKEDIN_SCHEMA_MISSING:${schemaHealth.missingTables.join(",")}`
    );
  }

  const integration = await loadIntegration(adminDb, job.integration_id, "LinkedIn");

  const accessToken = decryptAccessToken(integration, "LinkedIn");

  await runLinkedInFullSync(adminDb, job.user_id, job.integration_id, {
    accessToken,
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

  if (job.provider === "razorpay") {
    await processRazorpayJob(adminDb, job);
    return;
  }

  if (job.provider === "gmail") {
    await processGmailJob(adminDb, job);
    return;
  }

  if (job.provider === "github") {
    await processGitHubJob(adminDb, job);
    return;
  }

  if (job.provider === "linkedin") {
    await processLinkedInJob(adminDb, job);
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
  const candidateLimit = Math.min(Math.max(limit * 10, 25), 100);
  const snapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
    .where("next_retry_at", "<=", nowIso)
    .orderBy("next_retry_at", "asc")
    .limit(candidateLimit)
    .get();

  const jobs = snapshot.docs
    .map((doc) => doc.data() as SyncJobRow)
    .filter(
      (job) => job.status === "pending" || job.status === "failed"
    )
    .filter((job) => (options.userId ? job.user_id === options.userId : true))
    .filter((job) =>
      options.provider ? job.provider === options.provider : true
    )
    .sort((left, right) => {
      const retryAtDiff = (left.next_retry_at || "").localeCompare(
        right.next_retry_at || ""
      );
      if (retryAtDiff !== 0) {
        return retryAtDiff;
      }

      return (left.created_at || "").localeCompare(right.created_at || "");
    })
    .slice(0, limit);

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
          message.startsWith("FACEBOOK_SCHEMA_MISSING")) ||
        (job.provider === "linkedin" &&
          message.startsWith("LINKEDIN_SCHEMA_MISSING"));

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

      const googleApiDisabled = isGoogleApiDisabledError(job.provider, message);

      const retryable = job.attempt_count < job.max_attempts;
      const delayMinutes = Math.min(
        2 ** Math.max(job.attempt_count - 1, 0),
        60
      );
      const nextRetryAt = retryable
        ? googleApiDisabled
          ? null
          : new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        : null;

      if (googleApiDisabled) {
        await adminDb
          .collection(COLLECTIONS.INTEGRATIONS)
          .doc(job.integration_id)
          .update({ status: "error" });
      }

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
