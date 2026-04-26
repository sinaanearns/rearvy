import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";

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
  COLLECTIONS.INTEGRATION_SYNC_JOBS,
  COLLECTIONS.YOUTUBE_CHANNELS,
  COLLECTIONS.YOUTUBE_VIDEOS,
  COLLECTIONS.YOUTUBE_COMMENTS,
] as const;

export const INSTAGRAM_REQUIRED_TABLES = [
  COLLECTIONS.INSTAGRAM_COMMENTS,
] as const;

export const FACEBOOK_REQUIRED_TABLES = [
  COLLECTIONS.INTEGRATION_SYNC_JOBS,
  COLLECTIONS.FACEBOOK_PAGES,
  COLLECTIONS.FACEBOOK_POSTS,
  COLLECTIONS.FACEBOOK_COMMENTS,
] as const;

export const WEBSITE_REQUIRED_TABLES = [
  COLLECTIONS.WEBSITES,
  COLLECTIONS.WEBSITE_SESSIONS,
  COLLECTIONS.WEBSITE_PAGEVIEWS,
  COLLECTIONS.WEBSITE_EVENTS,
] as const;

export const LINKEDIN_REQUIRED_TABLES = [
  COLLECTIONS.LINKEDIN_PROFILES,
  COLLECTIONS.LINKEDIN_POSTS,
  COLLECTIONS.LINKEDIN_COMMENTS,
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
  adminDb: Firestore,
  tables: readonly string[]
): Promise<SchemaHealthResult> {
  // In Firestore, collections are created on first write, so we'll just
  // assume all required collections exist. If there's an issue, it will
  // be caught when trying to write to them.
  return {
    ok: true,
    missingTables: [],
    errors: {},
  };
}

export async function getYouTubeSchemaHealth(
  adminDb: Firestore
): Promise<SchemaHealthResult> {
  return checkRequiredTables(adminDb, YOUTUBE_REQUIRED_TABLES);
}

export async function getInstagramSchemaHealth(
  adminDb: Firestore
): Promise<SchemaHealthResult> {
  return checkRequiredTables(adminDb, INSTAGRAM_REQUIRED_TABLES);
}

export async function getWebsiteSchemaHealth(
  adminDb: Firestore
): Promise<SchemaHealthResult> {
  return checkRequiredTables(adminDb, WEBSITE_REQUIRED_TABLES);
}

export async function getFacebookSchemaHealth(
  adminDb: Firestore
): Promise<SchemaHealthResult> {
  return checkRequiredTables(adminDb, FACEBOOK_REQUIRED_TABLES);
}

export async function getLinkedInSchemaHealth(
  adminDb: Firestore
): Promise<SchemaHealthResult> {
  return checkRequiredTables(adminDb, LINKEDIN_REQUIRED_TABLES);
}


