import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { randomBytes } from "crypto";
import { setOAuthSessionCookies } from "@/lib/integrations/oauth-session";
import { getAppOrigin } from "@/lib/utils/url";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) {
      return error;
    }

    const clientId = process.env.META_APP_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Instagram integration not configured. Set META_APP_ID." },
        { status: 500 }
      );
    }

    const appOrigin = getAppOrigin(request);
    const state = randomBytes(16).toString("hex");
    const redirectUri = `${appOrigin}/api/integrations/instagram/callback`;

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
    setOAuthSessionCookies(response, "instagram_oauth", state, user.uid);

    return response;
  } catch (err) {
    console.error("Instagram connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
