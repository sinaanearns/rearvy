import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/google-analytics/sync";

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminSupabase = createAdminClient();

    const { data: integration, error } = await adminSupabase
      .from("integrations")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "google_analytics")
      .eq("status", "active")
      .maybeSingle();

    if (error || !integration) {
      return NextResponse.json(
        { error: "No active Google Analytics integration found" },
        { status: 404 }
      );
    }

    const refreshIv = (
      integration.sync_cursor as { refresh_iv?: string } | null
    )?.refresh_iv;

    if (!integration.refresh_token_enc || !refreshIv) {
      return NextResponse.json(
        { error: "Integration missing refresh token" },
        { status: 500 }
      );
    }

    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );
    const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
    const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

    const result = await runFullSync(
      adminSupabase,
      user.id,
      integration.id,
      {
        accessToken,
        refreshToken,
        tokenExpiresAt,
      }
    );

    return NextResponse.json({
      success: true,
      synced: result,
    });
  } catch (err) {
    console.error("GA4 sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
