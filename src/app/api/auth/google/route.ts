import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "/chat";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    // Firebase handles OAuth flow on the client-side
    // This endpoint can be used for server-side OAuth initiation if needed
    // For now, redirect to the login page with redirect parameter

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "");
    googleAuthUrl.searchParams.set("redirect_uri", `${appUrl}/callback?redirect=${encodeURIComponent(redirect)}`);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid profile email");

    return NextResponse.json({ 
      url: googleAuthUrl.toString(),
      message: "Use Firebase client SDK for OAuth flow"
    });
  } catch (error) {
    console.error("Google auth API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : message,
      },
      { status: 500 }
    );
  }
}

