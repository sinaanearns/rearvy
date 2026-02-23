import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";
import { getShopInfo } from "@/lib/integrations/shopify/client";
import { runFullSync } from "@/lib/integrations/shopify/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state");

  if (!code || !shop) {
    return NextResponse.redirect(
      new URL("/integrations?error=missing_params", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  // CSRF: validate state matches the cookie set during /connect
  const cookieState = request.cookies.get("shopify_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return NextResponse.redirect(
      new URL("/integrations?error=invalid_state", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  try {
    // Exchange code for permanent access token
    const tokenRes = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      }
    );

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const scopes = tokenData.scope?.split(",") || [];

    // Get shop info
    const shopInfo = await getShopInfo({ shopDomain: shop, accessToken });

    // Encrypt the access token
    const { encrypted, iv } = encrypt(accessToken);

    // Store integration using admin client (bypasses RLS for insert)
    const adminSupabase = createAdminClient();
    const { data: integration, error: insertError } = await adminSupabase
      .from("integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "shopify",
          provider_account_id: String(shopInfo.id),
          provider_account_name: `${shopInfo.name} (${shop})`,
          access_token_enc: encrypted,
          token_iv: iv,
          scopes,
          status: "active",
        },
        { onConflict: "user_id,provider" }
      )
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save integration: ${insertError.message}`);
    }

    // Trigger initial sync in background
    runFullSync(adminSupabase, user.id, integration.id, {
      shopDomain: shop,
      accessToken,
    }).catch((err) =>
      console.error("Initial sync failed:", err)
    );

    return NextResponse.redirect(
      new URL("/integrations?success=shopify_connected", process.env.NEXT_PUBLIC_APP_URL!)
    );
  } catch (error) {
    console.error("Shopify OAuth error:", error);
    return NextResponse.redirect(
      new URL("/integrations?error=oauth_failed", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }
}
