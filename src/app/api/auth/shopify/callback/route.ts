import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { encrypt } from "@/lib/utils/encryption";
import { getShopInfo } from "@/lib/integrations/shopify/client";
import {
  isRecentShopifyTimestamp,
  normalizeShopifyDomain,
  verifyShopifyOAuthHmac,
} from "@/lib/integrations/shopify/security";

const STATE_COOKIE = "shopify_saas_state";
const UID_COOKIE = "shopify_saas_uid";
const SHOP_COOKIE = "rearvy_shopify_shop";

function getAppOrigin(): string {
  const host = process.env.HOST;
  if (!host) {
    return "https://rearvy.com";
  }
  return new URL(host).origin;
}

function redirectToDashboard(
  shopDomain: string,
  error?: string
): NextResponse {
  const appOrigin = getAppOrigin();
  const target = new URL("/dashboard", appOrigin);
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
      console.error("[Shopify Callback] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET");
      return redirectToDashboard("unknown.myshopify.com", "shopify_not_configured");
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const rawShop = searchParams.get("shop");
    const state = searchParams.get("state");
    const timestamp = searchParams.get("timestamp");

    const shopDomain = rawShop ? normalizeShopifyDomain(rawShop) : null;

    console.log("[Shopify Callback] Received:", {
      shop: rawShop,
      shopDomain,
      hasCode: !!code,
      hasState: !!state,
      timestamp,
    });

    if (!code || !shopDomain) {
      console.error("[Shopify Callback] Missing code or invalid shop domain");
      return redirectToDashboard(
        shopDomain ?? "unknown.myshopify.com",
        "missing_params"
      );
    }

    // Verify CSRF state
    const cookieState =
      request.cookies.get(STATE_COOKIE)?.value ||
      request.cookies.get("shopify_oauth_state")?.value;

    if (!state || !cookieState || state !== cookieState) {
      console.error("[Shopify Callback] State mismatch:", {
        urlState: state,
        cookieState: cookieState ?? "not found",
      });
      return redirectToDashboard(shopDomain, "invalid_state");
    }

    // Verify timestamp is recent
    if (!isRecentShopifyTimestamp(timestamp)) {
      console.error("[Shopify Callback] Expired timestamp:", timestamp);
      return redirectToDashboard(shopDomain, "expired_oauth_request");
    }

    // Verify HMAC
    if (!verifyShopifyOAuthHmac(searchParams, apiSecret)) {
      console.error("[Shopify Callback] HMAC verification failed");
      return redirectToDashboard(shopDomain, "invalid_hmac");
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
      console.error("[Shopify Callback] Token exchange failed:", {
        status: tokenRes.status,
        body: errorBody,
      });
      return redirectToDashboard(shopDomain, "token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    const accessToken = String(tokenData.access_token || "");
    const scopes = String(tokenData.scope || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (!accessToken) {
      console.error("[Shopify Callback] No access_token in response");
      return redirectToDashboard(shopDomain, "missing_access_token");
    }

    console.log("[Shopify Callback] Token obtained, fetching shop info...");

    // Fetch shop info to verify the installation
    const shopInfo = await getShopInfo({ shopDomain, accessToken });
    const canonicalDomain = normalizeShopifyDomain(shopInfo.myshopify_domain);

    if (!canonicalDomain) {
      console.error("[Shopify Callback] Could not normalize canonical domain:", shopInfo.myshopify_domain);
      return redirectToDashboard(shopDomain, "shop_domain_mismatch");
    }

    const { encrypted, iv } = encrypt(accessToken);

    // Store connection keyed by shop domain
    await adminDb
      .collection("shopify_connections")
      .doc(canonicalDomain)
      .set(
        {
          shop_domain: canonicalDomain,
          provider: "shopify",
          provider_account_id: String(shopInfo.id),
          provider_account_name: `${shopInfo.name} (${canonicalDomain})`,
          access_token_enc: encrypted,
          token_iv: iv,
          scopes,
          status: "active",
          updated_at: new Date(),
          installed_at: new Date(),
        },
        { merge: true }
      );

    // Optionally link to a Rearvy user if uid was passed at start
    const userId =
      request.cookies.get(UID_COOKIE)?.value ||
      request.cookies.get("shopify_oauth_uid")?.value ||
      null;

    if (userId) {
      const integrationRef = adminDb.collection(COLLECTIONS.INTEGRATIONS);
      const existing = await integrationRef
        .where("user_id", "==", userId)
        .where("provider", "==", "shopify")
        .limit(1)
        .get();

      const baseData = {
        user_id: userId,
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

      if (existing.empty) {
        await integrationRef.add({ ...baseData, created_at: new Date() });
      } else {
        await integrationRef
          .doc(existing.docs[0].id)
          .set(baseData, { merge: true });
      }
    }

    console.log("[Shopify Callback] Success! Redirecting to dashboard for:", canonicalDomain);
    return redirectToDashboard(canonicalDomain);
  } catch (error) {
    console.error("[Shopify Callback] Unhandled error:", error);
    return redirectToDashboard("unknown.myshopify.com", "oauth_failed");
  }
}
