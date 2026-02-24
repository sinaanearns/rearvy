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

  // Delete integration and cascade-related data
  const { error } = await adminSupabase
    .from("integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "shopify");

  if (error) {
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }

  // Clean up synced data
  await adminSupabase.from("products").delete().eq("user_id", user.id);
  await adminSupabase.from("orders").delete().eq("user_id", user.id);
  await adminSupabase
    .from("business_metrics")
    .delete()
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
