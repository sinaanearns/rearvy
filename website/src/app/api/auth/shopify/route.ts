import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { randomBytes } from "crypto";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";
import { createServerLogger } from "@/lib/server-logger";

const STATE_COOKIE = "shopify_saas_state";
const UID_COOKIE = "shopify_saas_uid";
const log = createServerLogger("ShopifyOAuth");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SHOPIFY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Shopify integration not configured. Set SHOPIFY_API_KEY." },
        { status: 500 }
      );
    }

    const host = process.env.HOST;
    if (!host) {
      return NextResponse.json(
        { error: "HOST environment variable is required." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawShop = searchParams.get("shop");
    const uid = searchParams.get("uid");

    if (!rawShop) {
      return NextResponse.json(
        { error: "Missing shop parameter. Usage: ?shop=STORE.myshopify.com" },
        { status: 400 }
      );
    }

    const shopDomain = normalizeShopifyDomain(rawShop);
    if (!shopDomain) {
      return NextResponse.json(
        { error: "Invalid Shopify domain. Must be STORE.myshopify.com" },
        { status: 400 }
      );
    }

    const scopes =
      process.env.SHOPIFY_SCOPES || "read_products,read_orders,read_inventory";

    const state = randomBytes(16).toString("hex");
    const redirectUri = `${new URL(host).origin}/api/auth/shopify/callback`;

    // Build the authorize URL manually to avoid URLSearchParams encoding
    // commas in scopes as %2C. Shopify expects raw commas.
    const installUrl =
      `https://${shopDomain}/admin/oauth/authorize` +
      `?client_id=${apiKey}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    log.debug("Start redirect", {
      shop: shopDomain,
      redirect_uri: redirectUri,
      scopes,
    });

    const response = NextResponse.redirect(installUrl, 302);
    response.cookies.set(STATE_COOKIE, state, COOKIE_OPTIONS);
    response.cookies.set(UID_COOKIE, uid ?? "", COOKIE_OPTIONS);

    return response;
  } catch (error) {
    return handleApiError(error, "GET /api/auth/shopify");
  }
}
