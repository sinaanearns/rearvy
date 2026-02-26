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

  let body: { website_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { website_id } = body;
  if (!website_id) {
    return NextResponse.json(
      { error: "Missing website_id" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();

  const { data: website } = await adminSupabase
    .from("websites")
    .select("id")
    .eq("id", website_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!website) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }

  // CASCADE on websites FK will delete sessions, pageviews, and events
  const { error } = await adminSupabase
    .from("websites")
    .delete()
    .eq("id", website_id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to disconnect website:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
