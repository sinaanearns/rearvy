import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "/chat";

    // App sign-in uses Firebase Auth from the client. A Google OAuth URL built
    // here is invalid because the redirect must go through Firebase's auth
    // handler, not an app-owned callback route.
    return NextResponse.json(
      {
        error: "Google app sign-in is handled by the Firebase client SDK.",
        loginUrl: `/login?redirect=${encodeURIComponent(redirect)}`,
      },
      { status: 400 }
    );
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

