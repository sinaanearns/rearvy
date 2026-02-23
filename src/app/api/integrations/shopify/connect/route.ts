import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function GET() {
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

  const shop = new URL(`${process.env.NEXT_PUBLIC_APP_URL}`).searchParams.get("shop");

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
  const response = NextResponse.json({ message: "Redirect required" });
  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  // Return the URL for the frontend to redirect to
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return NextResponse.json({ url: installUrl });
}
