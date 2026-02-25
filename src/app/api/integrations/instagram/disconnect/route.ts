import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Delete integration record
  const { error } = await adminSupabase
    .from("integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "instagram");

  if (error) {
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }

  // Clean up all Instagram-specific synced data
  await adminSupabase
    .from("instagram_accounts")
    .delete()
    .eq("user_id", user.id);
  await adminSupabase
    .from("instagram_posts")
    .delete()
    .eq("user_id", user.id);
  await adminSupabase
    .from("instagram_comments")
    .delete()
    .eq("user_id", user.id);
  await adminSupabase
    .from("instagram_analytics")
    .delete()
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
