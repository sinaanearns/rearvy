import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { randomBytes } from "crypto";
import { isGoogleIntegrationConfigured } from "@/lib/integrations/provider-config";
import { setOAuthSessionCookies } from "@/lib/integrations/oauth-session";
import { getGoogleOAuthAuthorizationRedirectUri } from "@/lib/integrations/google-oauth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!isGoogleIntegrationConfigured() || !clientId) {
      return NextResponse.json(
        { error: "Google Analytics integration is not configured on this server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables." },
        { status: 503 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const redirectUri = getGoogleOAuthAuthorizationRedirectUri(request);

    const scopes = [
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/analytics",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.json({ url: authUrl.toString() });
    setOAuthSessionCookies(response, "ga4_oauth", state, user.uid);

    return response;
  } catch (err) {
    console.error("Google Analytics connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
