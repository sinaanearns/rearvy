import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      return NextResponse.json(
        { error: "TikTok integration not configured. Set TIKTOK_CLIENT_KEY." },
        { status: 500 }
      );
    }

    const state = randomBytes(16).toString("hex");
    const codeVerifier = randomBytes(32).toString("hex");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/tiktok/callback`;

    const scopes = "user.info.basic,user.info.stats,video.list";

    const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
    authUrl.searchParams.set("client_key", clientKey);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.json({ url: authUrl.toString() });

    response.cookies.set("tiktok_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    response.cookies.set("tiktok_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("TikTok connect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
