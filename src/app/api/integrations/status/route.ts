import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function GET() {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { count: instagramPostsCount } = await supabase
    .from("instagram_posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: instagramCommentsCount } = await supabase
    .from("instagram_comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    integrations: integrations || [],
    syncedData: {
      products: productsCount || 0,
      orders: ordersCount || 0,
      videos: videosCount || 0,
      youtubeComments: youtubeCommentsCount || 0,
      instagramPosts: instagramPostsCount || 0,
      instagramComments: instagramCommentsCount || 0,
    },
  });
}
