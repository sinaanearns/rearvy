import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.META_APP_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Instagram integration not configured. Set META_APP_ID." },
        { status: 500 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/instagram/callback`;

    const scopes = [
      "instagram_basic",
      "instagram_manage_insights",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ].join(",");

    const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    const response = NextResponse.json({ url: authUrl.toString() });
    response.cookies.set("instagram_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Instagram connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
