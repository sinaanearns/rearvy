import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Firebase uses client-side auth (Bearer tokens in API requests).
  // Dashboard route protection is handled client-side via onAuthStateChanged.
  // API routes enforce auth via requireAuth() middleware.
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
