import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseNetworkError,
  supabaseFetchWithTimeout,
} from "@/lib/supabase/network";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      global: {
        fetch: supabaseFetchWithTimeout,
      },
    }
  );

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  const isDashboardPage =
    request.nextUrl.pathname.startsWith("/chat") ||
    request.nextUrl.pathname.startsWith("/projects") ||
    request.nextUrl.pathname.startsWith("/insights") ||
    request.nextUrl.pathname.startsWith("/integrations") ||
    request.nextUrl.pathname.startsWith("/settings");

  try {
    // Always refresh session for everything except static files.
    // This prevents refresh loops that can trigger 429 errors.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect authenticated users away from auth pages.
    if (user && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/chat";
      return NextResponse.redirect(url);
    }

    // Redirect unauthenticated users to login for dashboard pages.
    if (!user && isDashboardPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } catch (error) {
    if (isSupabaseNetworkError(error)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Proxy warning: Supabase is unreachable, skipping session refresh."
        );
      }
    } else {
      console.error("Proxy error (Supabase connection failed):", error);
    }
    // Allow the request to continue even if Supabase is unreachable
    // This prevents the app from completely breaking
  }

  // API routes return their own 401/403 responses when needed.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
