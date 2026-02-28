import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { encrypt } from "@/lib/utils/encryption";
import { getShopInfo } from "@/lib/integrations/shopify/client";
import {
  isRecentShopifyTimestamp,
  normalizeShopifyDomain,
  verifyShopifyOAuthHmac,
} from "@/lib/integrations/shopify/security";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { getAppOrigin } from "@/lib/utils/url";

function redirectToIntegrations(query: string, request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(`/integrations?${query}`, getAppOrigin(request))
  );
  response.cookies.delete("shopify_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);

  if (authError) {
    return NextResponse.redirect(new URL("/login", getAppOrigin(request)));
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return redirectToIntegrations("error=shopify_not_configured", request);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawShop = searchParams.get("shop");
  const state = searchParams.get("state");
  const timestamp = searchParams.get("timestamp");
  const shopDomain = rawShop ? normalizeShopifyDomain(rawShop) : null;

  if (!code || !shopDomain) {
    return redirectToIntegrations("error=missing_params", request);
  }

  // CSRF: validate state matches the cookie set during /connect
  const cookieState = request.cookies.get("shopify_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return redirectToIntegrations("error=invalid_state", request);
  }

  if (!isRecentShopifyTimestamp(timestamp)) {
    return redirectToIntegrations("error=expired_oauth_request", request);
  }

  if (!verifyShopifyOAuthHmac(searchParams, apiSecret)) {
    return redirectToIntegrations("error=invalid_hmac", request);
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

    // Store integration using admin client
    const integrationRef = adminDb.collection(COLLECTIONS.INTEGRATIONS);
    
    // Check if integration already exists for this user and provider
    const existingQuery = await integrationRef
      .where("user_id", "==", user.uid)
      .where("provider", "==", "shopify")
      .limit(1)
      .get();

    let integration;
    const baseIntegrationData = {
      user_id: user.uid,
      provider: "shopify",
      provider_account_id: String(shopInfo.id),
      provider_account_name: `${shopInfo.name} (${canonicalDomain})`,
      access_token_enc: encrypted,
      token_iv: iv,
      scopes,
      status: "active",
      sync_cursor: { shop_domain: canonicalDomain },
      updated_at: new Date(),
    };

    if (!existingQuery.empty) {
      // Update existing integration
      const docId = existingQuery.docs[0].id;
      await integrationRef.doc(docId).update(baseIntegrationData);
      integration = { id: docId, ...baseIntegrationData };
    } else {
      // Create new integration
      const integrationData = {
        ...baseIntegrationData,
        created_at: new Date(),
      };
      const docRef = await integrationRef.add(integrationData);
      integration = { id: docRef.id, ...integrationData };
    }

    // Queue durable initial sync with retries.
    await enqueueSyncJob(adminDb, {
      userId: user.uid,
      integrationId: integration.id,
      provider: "shopify",
    });
    void triggerSyncWorker("shopify");

    return redirectToIntegrations("success=shopify_connected", request);
  } catch (error) {
    console.error("Shopify OAuth error:", error);
    return redirectToIntegrations("error=oauth_failed", request);
  }
}
