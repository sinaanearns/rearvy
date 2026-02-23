import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Delete integration record
  const { error } = await adminSupabase
    .from("integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "youtube");

  if (error) {
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }

  // Clean up all YouTube-specific synced data
  await adminSupabase
    .from("youtube_channels")
    .delete()
    .eq("user_id", user.id);
  await adminSupabase
    .from("youtube_videos")
    .delete()
    .eq("user_id", user.id);
  await adminSupabase
    .from("youtube_comments")
    .delete()
    .eq("user_id", user.id);
  await adminSupabase
    .from("youtube_analytics")
    .delete()
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
