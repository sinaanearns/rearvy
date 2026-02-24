import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/utils/encryption";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";
import { runFullSync as runShopifyFullSync } from "@/lib/integrations/shopify/sync";
import { runFullSync as runYouTubeFullSync } from "@/lib/integrations/youtube/sync";

export type SyncProvider = "shopify" | "youtube";

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

export async function enqueueSyncJob(
  supabase: SupabaseClient,
  params: {
    userId: string;
    integrationId: string;
    provider: SyncProvider;
    maxAttempts?: number;
  }
) {
  const { error } = await supabase.from("integration_sync_jobs").upsert(
    {
      user_id: params.userId,
      integration_id: params.integrationId,
      provider: params.provider,
      status: "pending",
      attempt_count: 0,
      max_attempts: params.maxAttempts || 5,
      next_retry_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "integration_id,provider" }
  );

  if (error) {
    throw new Error(`Failed to enqueue sync job: ${error.message}`);
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
  supabase: SupabaseClient,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const { data: integration, error } = await supabase
    .from("integrations")
    .select(
      "id, user_id, provider_account_name, access_token_enc, token_iv, sync_cursor"
    )
    .eq("id", job.integration_id)
    .eq("user_id", job.user_id)
    .eq("provider", "shopify")
    .maybeSingle();

  if (error || !integration) {
    throw new Error("Shopify integration not found for sync job");
  }

  const rawDomain = (
    integration.sync_cursor as { shop_domain?: string } | null
  )?.shop_domain;
  const fallbackDomain = integration.provider_account_name
    ?.match(/\(([^)]+)\)/)?.[1];
  const shopDomain = normalizeShopifyDomain(rawDomain || fallbackDomain || "");

  if (!shopDomain) {
    throw new Error("Shopify sync job missing valid shop domain");
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  await runShopifyFullSync(supabase, job.user_id, job.integration_id, {
    shopDomain,
    accessToken,
  });
}

async function processYouTubeJob(
  supabase: SupabaseClient,
  job: Pick<SyncJobRow, "integration_id" | "user_id">
) {
  const { data: integration, error } = await supabase
    .from("integrations")
    .select(
      "id, user_id, access_token_enc, refresh_token_enc, token_iv, token_expires_at, sync_cursor"
    )
    .eq("id", job.integration_id)
    .eq("user_id", job.user_id)
    .eq("provider", "youtube")
    .maybeSingle();

  if (error || !integration) {
    throw new Error("YouTube integration not found for sync job");
  }

  const refreshIv = (
    integration.sync_cursor as { refresh_iv?: string } | null
  )?.refresh_iv;

  if (!integration.refresh_token_enc || !refreshIv) {
    throw new Error("YouTube sync job missing refresh token");
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
  const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

  await runYouTubeFullSync(supabase, job.user_id, job.integration_id, {
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });
}

async function processJob(supabase: SupabaseClient, job: SyncJobRow) {
  if (job.provider === "shopify") {
    await processShopifyJob(supabase, job);
    return;
  }

  if (job.provider === "youtube") {
    await processYouTubeJob(supabase, job);
    return;
  }

  throw new Error(`Unsupported sync job provider: ${job.provider}`);
}

export async function runPendingSyncJobs(
  supabase: SupabaseClient,
  options: RunJobsOptions = {}
) {
  const nowIso = new Date().toISOString();
  const limit = Math.min(Math.max(options.limit || 3, 1), 20);

  let query = supabase
    .from("integration_sync_jobs")
    .select(
      "id, user_id, integration_id, provider, status, attempt_count, max_attempts, next_retry_at, created_at"
    )
    .in("status", ["pending", "failed"])
    .not("next_retry_at", "is", "null")
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  if (options.provider) {
    query = query.eq("provider", options.provider);
  }

  const { data: jobs, error } = await query;
  if (error) {
    throw new Error(`Failed to load sync jobs: ${error.message}`);
  }

  if (!jobs || jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs as SyncJobRow[]) {
    const nextAttempt = job.attempt_count + 1;

    const { data: claimed, error: claimError } = await supabase
      .from("integration_sync_jobs")
      .update({
        status: "processing",
        attempt_count: nextAttempt,
        next_retry_at: nowIso,
        last_error: null,
      })
      .eq("id", job.id)
      .in("status", ["pending", "failed"])
      .select(
        "id, user_id, integration_id, provider, status, attempt_count, max_attempts, next_retry_at"
      )
      .maybeSingle();

    if (claimError) {
      console.error("Failed to claim sync job:", claimError);
      continue;
    }

    if (!claimed) {
      continue;
    }

    try {
      await processJob(supabase, claimed as SyncJobRow);
      await supabase
        .from("integration_sync_jobs")
        .update({
          status: "succeeded",
          next_retry_at: null,
          last_error: null,
        })
        .eq("id", claimed.id);
      succeeded++;
    } catch (error) {
      failed++;

      const message =
        error instanceof Error ? error.message : "Unknown sync failure";
      const retryable = claimed.attempt_count < claimed.max_attempts;
      const delayMinutes = Math.min(
        2 ** Math.max(claimed.attempt_count - 1, 0),
        60
      );
      const nextRetryAt = retryable
        ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        : null;

      await supabase
        .from("integration_sync_jobs")
        .update({
          status: "failed",
          last_error: message.slice(0, 1000),
          next_retry_at: nextRetryAt,
        })
        .eq("id", claimed.id);
    }
  }

  return {
    processed: jobs.length,
    succeeded,
    failed,
  };
}
