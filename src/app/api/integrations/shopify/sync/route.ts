import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/shopify/sync";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createAdminClient();

  // Get integration with encrypted token
  const { data: integration, error } = await adminSupabase
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "shopify")
    .eq("status", "active")
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { error: "No active Shopify integration found" },
      { status: 404 }
    );
  }

  try {
    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );
    const shopDomain = integration.provider_account_name
      ?.match(/\((.+)\)/)?.[1];

    if (!shopDomain) {
      throw new Error("Could not determine shop domain");
    }

    const result = await runFullSync(
      adminSupabase,
      user.id,
      integration.id,
      { shopDomain, accessToken }
    );

    return NextResponse.json({ success: true, synced: result });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Sync failed";
    console.error("Shopify sync error:", error);

    // Mark integration as error if token is invalid
    if (message.includes("401") || message.includes("403")) {
      await adminSupabase
        .from("integrations")
        .update({ status: "error" })
        .eq("id", integration.id);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
