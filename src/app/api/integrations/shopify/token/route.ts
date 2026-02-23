import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";
import { getShopInfo } from "@/lib/integrations/shopify/client";
import { runFullSync } from "@/lib/integrations/shopify/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shopDomain, accessToken } = await req.json();

  if (!shopDomain || !accessToken) {
    return NextResponse.json(
      { error: "Shop domain and access token are required" },
      { status: 400 }
    );
  }

  // Normalize shop domain
  let normalizedDomain = shopDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!normalizedDomain.includes(".myshopify.com")) {
    normalizedDomain = `${normalizedDomain}.myshopify.com`;
  }

  try {
    // Verify the token works by fetching shop info
    const shopInfo = await getShopInfo({
      shopDomain: normalizedDomain,
      accessToken,
    });

    // Encrypt the access token
    const { encrypted, iv } = encrypt(accessToken);

    // Store integration
    const adminSupabase = createAdminClient();
    const { data: integration, error: insertError } = await adminSupabase
      .from("integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "shopify",
          provider_account_id: String(shopInfo.id),
          provider_account_name: `${shopInfo.name} (${normalizedDomain})`,
          access_token_enc: encrypted,
          token_iv: iv,
          scopes: [
            "read_products",
            "read_orders",
            "read_customers",
            "read_inventory",
          ],
          status: "active",
        },
        { onConflict: "user_id,provider" }
      )
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save integration: ${insertError.message}`);
    }

    // Initial sync
    const syncResult = await runFullSync(
      adminSupabase,
      user.id,
      integration.id,
      { shopDomain: normalizedDomain, accessToken }
    );

    return NextResponse.json({
      success: true,
      shop: shopInfo.name,
      domain: normalizedDomain,
      synced: syncResult,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    console.error("Shopify manual connect error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
