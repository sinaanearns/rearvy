import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { NextRequest } from "next/server";
import {
  anonymousUserResponse,
  hasSupabaseAuthCookie,
  isSupabaseNetworkError,
} from "@/lib/supabase/network";
import { supabaseServerFetchWithTimeout } from "@/lib/supabase/server-fetch";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if proxy refreshes sessions.
          }
        },
      },
      global: {
        fetch: supabaseServerFetchWithTimeout,
      },
    }
  );
}

/**
 * Cached getUser() - deduplicates auth calls within a single request.
 * Proxy already calls getUser() to refresh the session; this ensures
 * layout and page components reuse that result instead of hitting Supabase again.
 */
export const getUser = cache(async () => {
  const cookieStore = await cookies();
  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return anonymousUserResponse();
  }

  const supabase = await createClient();

  try {
    return await supabase.auth.getUser();
  } catch (error) {
    if (isSupabaseNetworkError(error)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Supabase auth is unreachable, continuing as signed-out user."
        );
      }
      return anonymousUserResponse();
    }

    throw error;
  }
});

/**
 * Get user directly from the request cookies.
 * Use this in Route Handlers (API routes) where cookies() from next/headers
 * may not reflect the session refreshed by the proxy in Next.js 16.
 */
export async function getUserFromRequest(request: NextRequest) {
  if (!hasSupabaseAuthCookie(request.cookies.getAll())) {
    return anonymousUserResponse();
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Session refresh is handled by the proxy; route handlers
          // only need to read the (already-refreshed) session.
        },
      },
      global: {
        fetch: supabaseServerFetchWithTimeout,
      },
    }
  );

  try {
    return await supabase.auth.getUser();
  } catch (error) {
    if (isSupabaseNetworkError(error)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Supabase auth is unreachable, treating request as unauthenticated."
        );
      }
      return anonymousUserResponse();
    }

    throw error;
  }
}
