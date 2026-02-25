import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/tiktok/sync";
import { getTikTokSchemaHealth } from "@/lib/integrations/schema-health";

const TIKTOK_SCHEMA_MISSING = "TIKTOK_SCHEMA_MISSING";

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const schemaHealth = await getTikTokSchemaHealth(adminSupabase);

  if (!schemaHealth.ok) {
    const message = `Missing required TikTok tables: ${schemaHealth.missingTables.join(", ")}`;
    await adminSupabase
      .from("integrations")
      .update({ status: "error" })
      .eq("user_id", user.id)
      .eq("provider", "tiktok");

    return NextResponse.json(
      {
        error: message,
        errorCode: TIKTOK_SCHEMA_MISSING,
        missingTables: schemaHealth.missingTables,
      },
      { status: 503 }
    );
  }

  const { data: integration, error } = await adminSupabase
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "tiktok")
    .eq("status", "active")
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { error: "No active TikTok integration found" },
      { status: 404 }
    );
  }

  try {
    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );

    const refreshIv = (
      integration.sync_cursor as { refresh_iv?: string } | null
    )?.refresh_iv;

    if (!integration.refresh_token_enc || !refreshIv) {
      throw new Error("Missing refresh token data");
    }

    const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);

    const result = await runFullSync(adminSupabase, user.id, integration.id, {
      accessToken,
      refreshToken,
      tokenExpiresAt: new Date(integration.token_expires_at || 0),
    });

    await adminSupabase
      .from("integration_sync_jobs")
      .update({
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      })
      .eq("integration_id", integration.id)
      .eq("provider", "tiktok");

    return NextResponse.json({ success: true, synced: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("TikTok sync error:", error);

    if (
      message.includes("access_token_invalid") ||
      message.includes("token_expired")
    ) {
      await adminSupabase
        .from("integrations")
        .update({ status: "expired" })
        .eq("id", integration.id);
    }

    await adminSupabase
      .from("integration_sync_jobs")
      .update({
        status: "failed",
        last_error: message,
        next_retry_at: null,
      })
      .eq("integration_id", integration.id)
      .eq("provider", "tiktok");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
