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

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

const SHOP_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

function getHostOrigin(): string {
  const rawHost = process.env.HOST;
  if (!rawHost) {
    throw new Error("HOST is required. Set HOST=https://rearvy.com");
  }

  const origin = new URL(rawHost).origin;
  if (!origin.startsWith("https://")) {
    throw new Error("HOST must use https:// for Shopify OAuth");
  }

  return origin;
}

function clearTempCookies(response: NextResponse) {
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(UID_COOKIE);
  // Backward-compatible cleanup from existing integration route flow
  response.cookies.delete("shopify_oauth_state");
  response.cookies.delete("shopify_oauth_uid");
}

function redirectToDashboard(
  appOrigin: string,
  shopDomain: string,
  error?: string
): NextResponse {
  const target = new URL("/dashboard", appOrigin);
  target.searchParams.set("shop", shopDomain);
  if (error) {
    target.searchParams.set("error", error);
  }

  const response = NextResponse.redirect(target);
  response.cookies.set(SHOP_COOKIE, shopDomain, SHOP_COOKIE_OPTIONS);
  clearTempCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiKey || !apiSecret) {
      const fallbackOrigin = process.env.HOST
        ? new URL(process.env.HOST).origin
        : "https://rearvy.com";
      return redirectToDashboard(fallbackOrigin, "unknown.myshopify.com", "shopify_not_configured");
    }

    const appOrigin = getHostOrigin();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const rawShop = searchParams.get("shop");
    const state = searchParams.get("state");
    const timestamp = searchParams.get("timestamp");
    const shopDomain = rawShop ? normalizeShopifyDomain(rawShop) : null;

    if (!code || !shopDomain) {
      return redirectToDashboard(appOrigin, shopDomain ?? "unknown.myshopify.com", "missing_params");
    }

    const cookieState =
      request.cookies.get(STATE_COOKIE)?.value ||
      request.cookies.get("shopify_oauth_state")?.value;

    if (!state || !cookieState || state !== cookieState) {
      return redirectToDashboard(appOrigin, shopDomain, "invalid_state");
    }

    if (!isRecentShopifyTimestamp(timestamp)) {
      return redirectToDashboard(appOrigin, shopDomain, "expired_oauth_request");
    }

    if (!verifyShopifyOAuthHmac(searchParams, apiSecret)) {
      return redirectToDashboard(appOrigin, shopDomain, "invalid_hmac");
    }

    const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      return redirectToDashboard(appOrigin, shopDomain, "token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    const accessToken = String(tokenData.access_token || "");
    const scopes = String(tokenData.scope || "")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);

    if (!accessToken) {
      return redirectToDashboard(appOrigin, shopDomain, "missing_access_token");
    }

    const shopInfo = await getShopInfo({ shopDomain, accessToken });
    const canonicalDomain = normalizeShopifyDomain(shopInfo.myshopify_domain);
    if (!canonicalDomain || canonicalDomain !== shopDomain) {
      return redirectToDashboard(appOrigin, shopDomain, "shop_domain_mismatch");
    }

    const { encrypted, iv } = encrypt(accessToken);

    // Always store token by shop domain for SaaS usage.
    await adminDb.collection("shopify_connections").doc(canonicalDomain).set(
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

    // Optional linkage to a Rearvy user if uid was supplied when starting OAuth.
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
        await integrationRef.add({
          ...baseData,
          created_at: new Date(),
        });
      } else {
        await integrationRef.doc(existing.docs[0].id).set(baseData, { merge: true });
      }
    }

    return redirectToDashboard(appOrigin, canonicalDomain);
  } catch (error) {
    console.error("Shopify OAuth callback error:", error);
    const appOrigin = process.env.HOST
      ? new URL(process.env.HOST).origin
      : "https://rearvy.com";
    return redirectToDashboard(appOrigin, "unknown.myshopify.com", "oauth_failed");
  }
}
