import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPendingSyncJobs } from "@/lib/integrations/sync-jobs";
import {
  checkRequiredTables,
  getYouTubeSchemaHealth,
  isMissingTableError,
} from "@/lib/integrations/schema-health";

type CountResult = {
  count: number;
  error: string | null;
};

async function countRowsForUser(
  userId: string,
  table: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CountResult> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact" })
    .eq("user_id", userId)
    .limit(1);

  if (!error) {
    return { count: count || 0, error: null };
  }

  if (isMissingTableError(error)) {
    return { count: 0, error: `Table ${table} is missing` };
  }

  return {
    count: 0,
    error: error.message || `Failed to count ${table}`,
  };
}

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const syncJobsTableHealth = await checkRequiredTables(adminSupabase, [
    "integration_sync_jobs",
  ]);
  const youtubeSchemaHealth = await getYouTubeSchemaHealth(adminSupabase);

  // Opportunistically run at most one due sync job for this user.
  // Jobs are durable in DB and retried with backoff on failure.
  if (syncJobsTableHealth.ok) {
    try {
      await runPendingSyncJobs(adminSupabase, { userId: user.id, limit: 1 });
    } catch (error) {
      console.error("Failed to run pending sync jobs:", error);
    }
  }

  const supabase = await createClient();

  const { data: integrations, error: integrationsError } = await supabase
    .from("integrations")
    .select(
      "id, provider, provider_account_name, status, last_synced_at, scopes, created_at"
    )
    .eq("user_id", user.id);

  if (integrationsError) {
    return NextResponse.json(
      { error: "Failed to load integrations" },
      { status: 500 }
    );
  }

  // Also get counts of synced data
  const [productsCount, ordersCount, videosCount, youtubeCommentsCount] =
    await Promise.all([
      countRowsForUser(user.id, "products", supabase),
      countRowsForUser(user.id, "orders", supabase),
      countRowsForUser(user.id, "youtube_videos", supabase),
      countRowsForUser(user.id, "youtube_comments", supabase),
    ]);

  const connectedYouTube = integrations?.find(
    (integration) => integration.provider === "youtube"
  );

  const syncBlockedReason =
    connectedYouTube && !youtubeSchemaHealth.ok
      ? `Missing required YouTube tables: ${youtubeSchemaHealth.missingTables.join(", ")}`
      : !syncJobsTableHealth.ok
        ? "Sync job queue is unavailable because integration_sync_jobs is missing."
        : null;

  return NextResponse.json({
    integrations: integrations || [],
    syncedData: {
      products: productsCount.count,
      orders: ordersCount.count,
      videos: videosCount.count,
      youtubeComments: youtubeCommentsCount.count,
    },
    diagnostics: {
      schemaReady: youtubeSchemaHealth.ok && syncJobsTableHealth.ok,
      missingTables: [
        ...new Set([
          ...syncJobsTableHealth.missingTables,
          ...youtubeSchemaHealth.missingTables,
        ]),
      ],
      tableErrors: {
        ...syncJobsTableHealth.errors,
        ...youtubeSchemaHealth.errors,
        ...(productsCount.error ? { products: productsCount.error } : {}),
        ...(ordersCount.error ? { orders: ordersCount.error } : {}),
        ...(videosCount.error ? { youtube_videos: videosCount.error } : {}),
        ...(youtubeCommentsCount.error
          ? { youtube_comments: youtubeCommentsCount.error }
          : {}),
      },
      syncBlockedReason,
    },
  });
}
