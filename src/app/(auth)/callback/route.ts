import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/chat";

  // Firebase uses client-side OAuth handling via signInWithPopup.
  // This route is kept for compatibility but the actual sign-in happens client-side
  
  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_auth_code`
    );
  }

  try {
    // For Firebase OAuth, the actual token exchange happens on the client
    // This endpoint can be used for server-side verification if needed
    return NextResponse.redirect(`${origin}${redirect}`);
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
