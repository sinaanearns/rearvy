import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { randomBytes } from "crypto";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";
import { setOAuthSessionCookies } from "@/lib/integrations/oauth-session";
import { getAppOrigin } from "@/lib/utils/url";

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
    console.log("[Shopify Connect] Request received");
    
    const { user, error: authError } = await requireAuth(request);
    if (authError) {
      console.error("[Shopify Connect] Auth failed:", authError);
      return authError;
    }
    
    console.log("[Shopify Connect] Auth success for user:", user.uid);

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiKey || !apiSecret) {
      console.error("[Shopify Connect] Missing API credentials");
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
      console.error("[Shopify Connect] Missing shop parameter");
      return NextResponse.json(
        { error: "Missing shop parameter" },
        { status: 400 }
      );
    }

    const shopDomain = normalizeShopifyDomain(shop);
    if (!shopDomain) {
      console.error("[Shopify Connect] Invalid shop domain:", shop);
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

    // Build authorize URL with raw commas in scopes (Shopify expects this)
    const installUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    console.log("[Shopify Connect] Generated install URL for domain:", shopDomain);
    console.log("[Shopify Connect] Redirect URI:", redirectUri);
    console.log("[Shopify Connect] App origin:", appOrigin);

    const response = NextResponse.json({ url: installUrl });
    setOAuthSessionCookies(response, "shopify_oauth", state, user.uid);

    console.log("[Shopify Connect] Returning install URL to client");
    return response;
  } catch (err) {
    console.error("[Shopify Connect] Unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
