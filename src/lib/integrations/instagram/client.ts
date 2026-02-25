import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/utils/encryption";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export interface InstagramConfig {
  accessToken: string;
  tokenExpiresAt: Date;
}

// --- Graph API response types ---

export interface IGPageData {
  id: string;
  name: string;
  instagram_business_account?: { id: string };
}

export interface IGAccountData {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  biography?: string;
  website?: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
}

export interface IGMediaItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface IGMediaInsight {
  name: string;
  period: string;
  values: { value: number }[];
}

export interface IGAccountInsightValue {
  value: number;
  end_time: string;
}

export interface IGAccountInsight {
  name: string;
  period: string;
  values: IGAccountInsightValue[];
}

export interface IGComment {
  id: string;
  text: string;
  username?: string;
  timestamp: string;
  like_count?: number;
}

// --- Token management ---

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Long-lived token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000, // default 60 days
  };
}

export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("client_secret", process.env.META_APP_SECRET!);
  url.searchParams.set("fb_exchange_token", currentToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000,
  };
}

async function ensureFreshToken(config: InstagramConfig): Promise<string> {
  // Refresh if token expires within 7 days (long-lived tokens last 60 days)
  if (config.tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    const refreshed = await refreshLongLivedToken(config.accessToken);
    config.accessToken = refreshed.accessToken;
    config.tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  }
  return config.accessToken;
}

// --- Generic fetch wrapper ---

async function igFetch<T>(
  config: InstagramConfig,
  url: string,
  params?: Record<string, string>
): Promise<T> {
  const token = await ensureFreshToken(config);
  const u = new URL(url);
  u.searchParams.set("access_token", token);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, v);
    }
  }

  const res = await fetch(u.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Instagram API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- API methods ---

export async function getUserPages(
  config: InstagramConfig
): Promise<IGPageData[]> {
  const data = await igFetch<{
    data: IGPageData[];
  }>(config, `${GRAPH_API}/me/accounts`, {
    fields: "id,name,instagram_business_account",
  });

  return data.data || [];
}

export async function getInstagramAccount(
  config: InstagramConfig,
  igUserId: string
): Promise<IGAccountData> {
  return igFetch<IGAccountData>(config, `${GRAPH_API}/${igUserId}`, {
    fields:
      "id,username,name,profile_picture_url,biography,website,followers_count,follows_count,media_count",
  });
}

export async function getMedia(
  config: InstagramConfig,
  igUserId: string,
  after?: string
): Promise<{ media: IGMediaItem[]; nextCursor?: string }> {
  const params: Record<string, string> = {
    fields:
      "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: "50",
  };
  if (after) params.after = after;

  const data = await igFetch<{
    data: IGMediaItem[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(config, `${GRAPH_API}/${igUserId}/media`, params);

  return {
    media: data.data || [],
    nextCursor: data.paging?.next ? data.paging.cursors?.after : undefined,
  };
}

export async function getMediaInsights(
  config: InstagramConfig,
  mediaId: string
): Promise<{ reach?: number; impressions?: number; engagement?: number; saved?: number }> {
  try {
    const data = await igFetch<{ data: IGMediaInsight[] }>(
      config,
      `${GRAPH_API}/${mediaId}/insights`,
      { metric: "reach,impressions,engagement,saved" }
    );

    const result: Record<string, number> = {};
    for (const metric of data.data || []) {
      result[metric.name] = metric.values?.[0]?.value || 0;
    }

    return result;
  } catch {
    // Insights may not be available for all post types (e.g., story, album)
    return {};
  }
}

export async function getAccountInsights(
  config: InstagramConfig,
  igUserId: string,
  since: number,
  until: number
): Promise<IGAccountInsight[]> {
  const data = await igFetch<{ data: IGAccountInsight[] }>(
    config,
    `${GRAPH_API}/${igUserId}/insights`,
    {
      metric: "follower_count,impressions,reach,profile_views",
      period: "day",
      since: String(since),
      until: String(until),
    }
  );

  return data.data || [];
}

export async function getComments(
  config: InstagramConfig,
  mediaId: string,
  after?: string
): Promise<{ comments: IGComment[]; nextCursor?: string }> {
  const params: Record<string, string> = {
    fields: "id,text,username,timestamp,like_count",
    limit: "50",
  };
  if (after) params.after = after;

  const data = await igFetch<{
    data: IGComment[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(config, `${GRAPH_API}/${mediaId}/comments`, params);

  return {
    comments: data.data || [],
    nextCursor: data.paging?.next ? data.paging.cursors?.after : undefined,
  };
}

// --- Token persistence ---

export async function persistRefreshedToken(
  supabase: SupabaseClient,
  integrationId: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> {
  const { encrypted, iv } = encrypt(accessToken);
  await supabase
    .from("integrations")
    .update({
      access_token_enc: encrypted,
      token_iv: iv,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", integrationId);
}
