import type { SupabaseClient } from "@supabase/supabase-js";

export interface ToolContext {
  userId: string;
  supabase: SupabaseClient;
}
