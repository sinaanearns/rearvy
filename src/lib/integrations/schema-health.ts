import type { SupabaseClient } from "@supabase/supabase-js";

type TableCheckError = {
  code?: string;
  message?: string;
  details?: string;
};

export interface SchemaHealthResult {
  ok: boolean;
  missingTables: string[];
  errors: Record<string, string>;
}

export const YOUTUBE_REQUIRED_TABLES = [
  "integration_sync_jobs",
  "youtube_channels",
  "youtube_videos",
  "youtube_comments",
  "youtube_analytics",
] as const;

export const INSTAGRAM_REQUIRED_TABLES = [
  "integration_sync_jobs",
  "instagram_accounts",
  "instagram_posts",
  "instagram_comments",
  "instagram_analytics",
] as const;

export const WEBSITE_REQUIRED_TABLES = [
  "websites",
  "website_sessions",
  "website_pageviews",
  "website_events",
] as const;

export function isMissingTableError(error: unknown): boolean {
  const err = error as TableCheckError | null;
  if (!err) return false;

  if (err.code === "PGRST205" || err.code === "42P01") {
    return true;
  }

  const message = `${err.message || ""} ${err.details || ""}`.toLowerCase();
  return (
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export async function checkRequiredTables(
  supabase: SupabaseClient,
  tables: readonly string[]
): Promise<SchemaHealthResult> {
  const missingTables: string[] = [];
  const errors: Record<string, string> = {};
  const uniqueTables = [...new Set(tables)];

  await Promise.all(
    uniqueTables.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select("*")
        .limit(1);

      if (!error) return;

      if (isMissingTableError(error)) {
        missingTables.push(table);
        return;
      }

      errors[table] = error.message || "Unknown table check error";
    })
  );

  missingTables.sort();

  return {
    ok: missingTables.length === 0 && Object.keys(errors).length === 0,
    missingTables,
    errors,
  };
}

export async function getYouTubeSchemaHealth(
  supabase: SupabaseClient
): Promise<SchemaHealthResult> {
  return checkRequiredTables(supabase, YOUTUBE_REQUIRED_TABLES);
}

export async function getInstagramSchemaHealth(
  supabase: SupabaseClient
): Promise<SchemaHealthResult> {
  return checkRequiredTables(supabase, INSTAGRAM_REQUIRED_TABLES);
}

export async function getWebsiteSchemaHealth(
  supabase: SupabaseClient
): Promise<SchemaHealthResult> {
  return checkRequiredTables(supabase, WEBSITE_REQUIRED_TABLES);
}


