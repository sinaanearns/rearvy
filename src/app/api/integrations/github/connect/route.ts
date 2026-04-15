import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";

import { requireAuth } from "@/lib/firebase/middleware";
import { setOAuthSessionCookies } from "@/lib/integrations/oauth-session";
import { getAppOrigin } from "@/lib/utils/url";

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) {
      return authError;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            "GitHub integration is not configured on this server. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to your environment variables.",
        },
        { status: 503 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const redirectUri = `${getAppOrigin(request)}/api/integrations/github/callback`;
    const scopes = ["read:user", "user:email", "read:org", "repo"].join(" ");

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    const response = NextResponse.json({ url: authUrl.toString() });
    setOAuthSessionCookies(response, "github_oauth", state, user.uid);

    return response;
  } catch (err) {
    console.error("GitHub connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}