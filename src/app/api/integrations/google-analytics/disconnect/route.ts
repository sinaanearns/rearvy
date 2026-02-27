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

  try {
    const adminSupabase = createAdminClient();

    // Delete integration (cascade will handle related data)
    const { error } = await adminSupabase
      .from("integrations")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "google_analytics");

    if (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("GA4 disconnect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Disconnect failed" },
      { status: 500 }
    );
  }
}
