import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseFetchWithTimeout } from "@/lib/supabase/network";

let client: SupabaseClient | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: supabaseFetchWithTimeout,
        },
      }
    );
  }
  return client;
}
