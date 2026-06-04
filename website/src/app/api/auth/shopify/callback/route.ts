import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { encrypt } from "@/lib/utils/encryption";
import { safeDocId } from '@/lib/firebase/doc-utils';
import { getShopInfo } from "@/lib/integrations/shopify/client";
import { enqueueSyncJob, triggerSyncWorker } from "@/lib/integrations/sync-jobs";
import { createServerLogger } from "@/lib/server-logger";
import { getAppOrigin } from "@/lib/utils/url";
import {
  isRecentShopifyTimestamp,
  normalizeShopifyDomain,
  verifyShopifyOAuthHmac,
} from "@/lib/integrations/shopify/security";

const STATE_COOKIE = "shopify_saas_state";
const UID_COOKIE = "shopify_saas_uid";
const SHOP_COOKIE = "rearvy_shopify_shop";
const log = createServerLogger("ShopifyCallback");

function redirectToDashboard(
  shopDomain: string,
  error?: string,
  request?: NextRequest
): NextResponse {
  const appOrigin = request ? getAppOrigin(request) : (process.env.HOST ? new URL(process.env.HOST).origin : "https://rearvy.com");
  const target = new URL("/chat", appOrigin);
  target.searchParams.set("shop", shopDomain);
  if (error) {
    target.searchParams.set("error", error);
  }

  const response = NextResponse.redirect(target.toString(), 302);

  response.cookies.set(SHOP_COOKIE, shopDomain, {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Clean up temp cookies
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(UID_COOKIE);
  response.cookies.delete("shopify_oauth_state");
  response.cookies.delete("shopify_oauth_uid");

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret) {
      log.error("Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET");
      return redirectToDashboard("unknown.myshopify.com", "shopify_not_configured", request);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const rawShop = searchParams.get("shop");
    const state = searchParams.get("state");
    const timestamp = searchParams.get("timestamp");

    const shopDomain = rawShop ? normalizeShopifyDomain(rawShop) : null;

    log.debug("Received callback", {
      shop: rawShop,
      shopDomain,
      hasCode: !!code,
      hasState: !!state,
      timestamp,
    });

    if (!code || !shopDomain) {
      log.error("Missing code or invalid shop domain");
      return redirectToDashboard(
        shopDomain ?? "unknown.myshopify.com",
        "missing_params",
        request
      );
    }

    // Verify CSRF state
    const cookieState =
      request.cookies.get(STATE_COOKIE)?.value ||
      request.cookies.get("shopify_oauth_state")?.value;

    if (!state || !cookieState || state !== cookieState) {
      log.error("State mismatch", {
        urlState: state,
        cookieState: cookieState ?? "not found",
      });
      return redirectToDashboard(shopDomain, "invalid_state", request);
    }

    // Verify timestamp is recent
    if (!isRecentShopifyTimestamp(timestamp)) {
      log.error("Expired timestamp:", timestamp);
      return redirectToDashboard(shopDomain, "expired_oauth_request", request);
    }

    // Verify HMAC
    if (!verifyShopifyOAuthHmac(searchParams, apiSecret)) {
      log.error("HMAC verification failed");
      return redirectToDashboard(shopDomain, "invalid_hmac", request);
    }

    // Exchange authorization code for permanent access token
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
      const errorBody = await tokenRes.text();
      log.error("Token exchange failed", {
        status: tokenRes.status,
        body: errorBody,
      });
      return redirectToDashboard(shopDomain, "token_exchange_failed", request);
    }

    const tokenData = await tokenRes.json();
    const accessToken = String(tokenData.access_token || "");
    const scopes = String(tokenData.scope || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (!accessToken) {
      log.error("No access_token in response");
      return redirectToDashboard(shopDomain, "missing_access_token", request);
    }

    log.debug("Token obtained, fetching shop info");

    // Fetch shop info to verify the installation
    const shopInfo = await getShopInfo({ shopDomain, accessToken });
    const canonicalDomain = normalizeShopifyDomain(shopInfo.myshopify_domain);

    if (!canonicalDomain) {
      log.error("Could not normalize canonical domain:", shopInfo.myshopify_domain);
      return redirectToDashboard(shopDomain, "shop_domain_mismatch", request);
    }

    const { encrypted, iv } = encrypt(accessToken);

    // Consolidated integration data
    const integrationData = {
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

    // Optionally link to a Rearvy user if uid was passed at start
    const userId =
      request.cookies.get(UID_COOKIE)?.value ||
      request.cookies.get("shopify_oauth_uid")?.value ||
      null;

    if (userId) {
      // Authenticated flow: Link directly to the user
      const integrationRef = adminDb.collection(COLLECTIONS.INTEGRATIONS);
      const existing = await integrationRef
        .where("user_id", "==", userId)
        .where("provider", "==", "shopify")
        .limit(1)
        .get();

      let integrationId;
      if (existing.empty) {
        const docRef = await integrationRef.add({
          ...integrationData,
          user_id: userId,
          created_at: new Date()
        });
        integrationId = docRef.id;
      } else {
        integrationId = existing.docs[0].id;
        await integrationRef
          .doc(integrationId)
          .set({ ...integrationData, user_id: userId }, { merge: true });
      }

      // Queue initial sync
      await enqueueSyncJob(adminDb, {
        userId,
        integrationId,
        provider: "shopify",
      });
      void triggerSyncWorker("shopify");

      log.debug("Success, redirecting to dashboard for:", canonicalDomain);
      return redirectToDashboard(canonicalDomain, undefined, request);
    } else {
      // Unauthenticated flow (App Store install): 
      // 1. Record the connection as "pending_claim"
      // 2. Redirect to login to link the user
      await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .doc(safeDocId('pending', canonicalDomain))
        .set({
          ...integrationData,
          user_id: null,
          status: "pending_claim",
          created_at: new Date()
        }, { merge: true });

      const appOrigin = getAppOrigin(request);
      const loginUrl = new URL("/login", appOrigin);
      loginUrl.searchParams.set("claim_shop", canonicalDomain);
      
      log.debug("Unauthenticated install, redirecting to login to claim store:", canonicalDomain);
      return NextResponse.redirect(loginUrl.toString(), 302);
    }
  } catch (error) {
    log.error("Unhandled error:", error);
    return redirectToDashboard("unknown.myshopify.com", "oauth_failed", request);
  }
}
