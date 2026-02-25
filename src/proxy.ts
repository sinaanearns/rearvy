import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/supabase/network";

export async function proxy(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const isDashboardPage =
    request.nextUrl.pathname.startsWith("/chat") ||
    request.nextUrl.pathname.startsWith("/projects") ||
    request.nextUrl.pathname.startsWith("/insights") ||
    request.nextUrl.pathname.startsWith("/integrations") ||
    request.nextUrl.pathname.startsWith("/settings");

  // Only enforce session resolution on protected dashboard routes.
  if (!isDashboardPage) {
    return supabaseResponse;
  }

  const hasAuthCookie = hasSupabaseAuthCookie(request.cookies.getAll());
  if (!hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // API routes return their own 401/403 responses when needed.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
