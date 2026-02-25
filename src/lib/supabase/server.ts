import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { NextRequest } from "next/server";

const SKIP_AUTH = process.env.SKIP_AUTH === "true";

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
        setAll(cookiesToSet) {
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
    }
  );
}

/**
 * Cached getUser() - deduplicates auth calls within a single request.
 * Proxy already calls getUser() to refresh the session; this ensures
 * layout and page components reuse that result instead of hitting Supabase again.
 */
export const getUser = cache(async () => {
  // Development mode: return mock user when Supabase is unreachable
  if (SKIP_AUTH) {
    return {
      data: {
        user: {
          id: "dev-user-id",
          email: "dev@example.com",
          user_metadata: { full_name: "Dev User" },
        },
      },
      error: null,
    };
  }

  const supabase = await createClient();
  return supabase.auth.getUser();
});

/**
 * Get user directly from the request cookies.
 * Use this in Route Handlers (API routes) where cookies() from next/headers
 * may not reflect the session refreshed by the proxy in Next.js 16.
 */
export async function getUserFromRequest(request: NextRequest) {
  // Development mode: return mock user when Supabase is unreachable
  if (SKIP_AUTH) {
    return {
      data: {
        user: {
          id: "dev-user-id",
          email: "dev@example.com",
          user_metadata: { full_name: "Dev User" },
        },
      },
      error: null,
    };
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
    }
  );
  return supabase.auth.getUser();
}

