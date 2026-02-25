import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseNetworkError } from "@/lib/supabase/network";
import { supabaseServerFetchWithTimeout } from "@/lib/supabase/server-fetch";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirect = searchParams.get("redirect") || "/chat";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const cookiesToSet: Array<{
      name: string;
      value: string;
      options: CookieOptions;
    }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(nextCookiesToSet) {
            cookiesToSet.push(...nextCookiesToSet);
          },
        },
        global: {
          fetch: supabaseServerFetchWithTimeout,
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });

    if (error || !data?.url) {
      return NextResponse.json(
        { error: error?.message || "Unable to start Google sign-in." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ url: data.url });
    cookiesToSet.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  } catch (error) {
    if (isSupabaseNetworkError(error)) {
      return NextResponse.json(
        {
          error:
            "Unable to reach Supabase. Check DNS/network and try again.",
        },
        { status: 503 }
      );
    }

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
