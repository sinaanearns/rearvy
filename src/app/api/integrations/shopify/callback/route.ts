import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";
import { getShopInfo } from "@/lib/integrations/shopify/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isRecentShopifyTimestamp,
  normalizeShopifyDomain,
  verifyShopifyOAuthHmac,
} from "@/lib/integrations/shopify/security";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";

function redirectToIntegrations(query: string) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, process.env.NEXT_PUBLIC_APP_URL!)
  );
  response.cookies.delete("shopify_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return redirectToIntegrations("error=shopify_not_configured");
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawShop = searchParams.get("shop");
  const state = searchParams.get("state");
  const timestamp = searchParams.get("timestamp");
  const shopDomain = rawShop ? normalizeShopifyDomain(rawShop) : null;

  if (!code || !shopDomain) {
    return redirectToIntegrations("error=missing_params");
  }

  // CSRF: validate state matches the cookie set during /connect
  const cookieState = request.cookies.get("shopify_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state");
  }

  if (!isRecentShopifyTimestamp(timestamp)) {
    return redirectToIntegrations("error=expired_oauth_request");
  }

  if (!verifyShopifyOAuthHmac(searchParams, apiSecret)) {
    return redirectToIntegrations("error=invalid_hmac");
  }

  try {
    // Exchange code for permanent access token
    const tokenRes = await fetch(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
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
    const shopInfo = await getShopInfo({ shopDomain, accessToken });
    const canonicalDomain = normalizeShopifyDomain(shopInfo.myshopify_domain);
    if (!canonicalDomain || canonicalDomain !== shopDomain) {
      throw new Error("Shop domain mismatch");
    }

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
          provider_account_name: `${shopInfo.name} (${canonicalDomain})`,
          access_token_enc: encrypted,
          token_iv: iv,
          scopes,
          status: "active",
          sync_cursor: { shop_domain: canonicalDomain },
        },
        { onConflict: "user_id,provider" }
      )
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save integration: ${insertError.message}`);
    }

    // Queue durable initial sync with retries.
    await enqueueSyncJob(adminSupabase, {
      userId: user.id,
      integrationId: integration.id,
      provider: "shopify",
    });
    void triggerSyncWorker("shopify");

    return redirectToIntegrations("success=shopify_connected");
  } catch (error) {
    console.error("Shopify OAuth error:", error);
    return redirectToIntegrations("error=oauth_failed");
  }
}
