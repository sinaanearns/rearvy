import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/instagram/sync";
import { getInstagramSchemaHealth } from "@/lib/integrations/schema-health";

const INSTAGRAM_SCHEMA_MISSING = "INSTAGRAM_SCHEMA_MISSING";

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const schemaHealth = await getInstagramSchemaHealth(adminSupabase);

  if (!schemaHealth.ok) {
    const message = `Missing required Instagram tables: ${schemaHealth.missingTables.join(", ")}`;
    await adminSupabase
      .from("integrations")
      .update({ status: "error" })
      .eq("user_id", user.id)
      .eq("provider", "instagram");

    return NextResponse.json(
      {
        error: message,
        errorCode: INSTAGRAM_SCHEMA_MISSING,
        missingTables: schemaHealth.missingTables,
      },
      { status: 503 }
    );
  }

  const { data: integration, error } = await adminSupabase
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "instagram")
    .eq("status", "active")
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { error: "No active Instagram integration found" },
      { status: 404 }
    );
  }

  try {
    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );

    const igUserId = (
      integration.sync_cursor as { ig_user_id?: string } | null
    )?.ig_user_id;

    if (!igUserId) {
      throw new Error("Missing Instagram user ID in sync cursor");
    }

    const result = await runFullSync(adminSupabase, user.id, integration.id, {
      accessToken,
      tokenExpiresAt: new Date(integration.token_expires_at || 0),
    }, igUserId);

    await adminSupabase
      .from("integration_sync_jobs")
      .update({
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      })
      .eq("integration_id", integration.id)
      .eq("provider", "instagram");

    return NextResponse.json({ success: true, synced: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("Instagram sync error:", error);

    if (
      message.includes("190") ||
      message.includes("OAuthException") ||
      message.includes("invalid")
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
      .eq("provider", "instagram");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
