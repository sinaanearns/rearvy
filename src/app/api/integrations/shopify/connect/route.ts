import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";
import { getAppOrigin } from "@/lib/utils/url";

type ShopifyClientCheckResult =
  | { ok: true }
  | { ok: false; reason: "invalid_client" };

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

async function validateShopifyClient(
  shopDomain: string,
  apiKey: string,
  apiSecret: string
): Promise<ShopifyClientCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(
      `https://${shopDomain}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code: "rearvy_oauth_preflight",
        }),
        signal: controller.signal,
      }
    );

    const body = (await response.text()).toLowerCase();
    const invalidClient =
      body.includes("invalid_client") || body.includes("unauthorized_client");

    if (invalidClient) {
      return { ok: false, reason: "invalid_client" };
    }

    return { ok: true };
  } catch {
    // On transient network failures, let user proceed to Shopify authorization.
    return { ok: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error:
            "Shopify integration not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json(
        { error: "Missing shop parameter" },
        { status: 400 }
      );
    }

    const shopDomain = normalizeShopifyDomain(shop);
    if (!shopDomain) {
      return NextResponse.json(
        { error: "Invalid Shopify domain format" },
        { status: 400 }
      );
    }

    // Generate state nonce
    const state = randomBytes(16).toString("hex");

    const scopes = getShopifyScopes();

    const appOrigin = getAppOrigin(request);
    const redirectUri = `${appOrigin}/api/integrations/shopify/callback`;
    const redirectUrl = new URL(redirectUri);
    const isLocalhost =
      redirectUrl.hostname === "localhost" ||
      redirectUrl.hostname === "127.0.0.1";

    if (redirectUrl.protocol !== "https:" && !isLocalhost) {
      return NextResponse.json(
        {
          error:
            "Invalid app URL for Shopify OAuth. Use https:// in NEXT_PUBLIC_APP_URL.",
        },
        { status: 500 }
      );
    }

    const clientCheck = await validateShopifyClient(
      shopDomain,
      apiKey,
      apiSecret
    );
    if (!clientCheck.ok) {
      return NextResponse.json(
        {
          error:
            "Shopify API key/secret is not valid for this store. Verify the app credentials and store domain.",
        },
        { status: 400 }
      );
    }

    // Store state in a cookie for CSRF verification
    const installUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    const response = NextResponse.json({ url: installUrl });
    response.cookies.set("shopify_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Shopify connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
