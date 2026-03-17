import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";

const STATE_COOKIE = "shopify_saas_state";
const UID_COOKIE = "shopify_saas_uid";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
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

function getShopifyScopes(): string {
  const envScopes = process.env.SHOPIFY_SCOPES
    ?.split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  const defaultScopes = [
    "read_products",
    "read_orders",
    "read_inventory",
  ];

  return (envScopes && envScopes.length > 0 ? envScopes : defaultScopes).join(
    ","
  );
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.SHOPIFY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Shopify integration not configured. Set SHOPIFY_API_KEY." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawShop = searchParams.get("shop");
    const uid = searchParams.get("uid");

    if (!rawShop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    const shopDomain = normalizeShopifyDomain(rawShop);
    if (!shopDomain) {
      return NextResponse.json({ error: "Invalid Shopify domain" }, { status: 400 });
    }

    const state = randomBytes(16).toString("hex");
    const appOrigin = getHostOrigin();
    const redirectUri = `${appOrigin}/api/auth/shopify/callback`;

    const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", apiKey);
    authUrl.searchParams.set("scope", getShopifyScopes());
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(STATE_COOKIE, state, COOKIE_OPTIONS);
    response.cookies.set(UID_COOKIE, uid ?? "", COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Shopify OAuth start error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
