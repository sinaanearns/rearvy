import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/shopify/sync";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

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
    const isDemoIntegration = Boolean(
      (integration.sync_cursor as { demo?: boolean } | null)?.demo
    );

    if (isDemoIntegration) {
      const syncedAt = new Date().toISOString();
      await adminSupabase
        .from("integrations")
        .update({ last_synced_at: syncedAt })
        .eq("id", integration.id);

      const [{ count: productsCount }, { count: ordersCount }] = await Promise.all([
        adminSupabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("integration_id", integration.id),
        adminSupabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("integration_id", integration.id),
      ]);

      await adminSupabase
        .from("integration_sync_jobs")
        .update({
          status: "succeeded",
          next_retry_at: null,
          last_error: null,
        })
        .eq("integration_id", integration.id)
        .eq("provider", "shopify");

      return NextResponse.json({
        success: true,
        demo: true,
        synced: {
          products: productsCount || 0,
          orders: ordersCount || 0,
          metrics: 0,
          insights: 0,
        },
      });
    }

    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );
    const rawStoredDomain = (
      integration.sync_cursor as { shop_domain?: string } | null
    )?.shop_domain;

    const fallbackDomain = integration.provider_account_name
      ?.match(/\(([^)]+)\)/)?.[1];

    const shopDomain = normalizeShopifyDomain(rawStoredDomain || fallbackDomain || "");

    if (!shopDomain) {
      throw new Error("Could not determine shop domain");
    }

    const result = await runFullSync(
      adminSupabase,
      user.id,
      integration.id,
      { shopDomain, accessToken }
    );

    await adminSupabase
      .from("integration_sync_jobs")
      .update({
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      })
      .eq("integration_id", integration.id)
      .eq("provider", "shopify");

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

    await adminSupabase
      .from("integration_sync_jobs")
      .update({
        status: "failed",
        last_error: message,
        next_retry_at: null,
      })
      .eq("integration_id", integration.id)
      .eq("provider", "shopify");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
