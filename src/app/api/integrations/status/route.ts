import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPendingSyncJobs } from "@/lib/integrations/sync-jobs";

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Opportunistically run at most one due sync job for this user.
  // Jobs are durable in DB and retried with backoff on failure.
  try {
    const adminSupabase = createAdminClient();
    await runPendingSyncJobs(adminSupabase, { userId: user.id, limit: 1 });
  } catch (error) {
    console.error("Failed to run pending sync jobs:", error);
  }

  const supabase = await createClient();

  const { data: integrations } = await supabase
    .from("integrations")
    .select(
      "id, provider, provider_account_name, status, last_synced_at, scopes, created_at"
    )
    .eq("user_id", user.id);

  // Also get counts of synced data
  const { count: productsCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: ordersCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: videosCount } = await supabase
    .from("youtube_videos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: youtubeCommentsCount } = await supabase
    .from("youtube_comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    integrations: integrations || [],
    syncedData: {
      products: productsCount || 0,
      orders: ordersCount || 0,
      videos: videosCount || 0,
      youtubeComments: youtubeCommentsCount || 0,
    },
  });
}
