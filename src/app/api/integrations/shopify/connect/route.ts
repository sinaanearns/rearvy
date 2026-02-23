import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Shopify integration not configured. Set SHOPIFY_API_KEY." },
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

  // Normalize: ensure it ends with .myshopify.com
  const shopDomain = shop.includes(".myshopify.com")
    ? shop
    : `${shop}.myshopify.com`;

  // Generate state nonce
  const state = randomBytes(16).toString("hex");

  const scopes = [
    "read_products",
    "read_orders",
    "read_customers",
    "read_inventory",
    "read_analytics",
  ].join(",");

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`;

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
}
