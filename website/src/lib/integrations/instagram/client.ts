import {
  GRAPH_API,
  exchangeForLongLivedToken as metaExchangeForLongLivedToken,
  metaFetch,
  refreshLongLivedToken as metaRefreshLongLivedToken,
  type MetaPlatformLabels,
  type MetaTokenConfig,
  type MetaTokenResult,
} from "@/lib/integrations/meta-oauth";
import { createServerLogger } from "@/lib/server-logger";

export { persistRefreshedToken } from "@/lib/integrations/meta-oauth";

const log = createServerLogger("InstagramClient");

const INSTAGRAM_LABELS: MetaPlatformLabels = {
  apiLabel: "Instagram",
  exchangeFailure: "Long-lived token exchange failed",
  exchangeMissingToken:
    "Long-lived token exchange response did not include an access token",
  refreshFailure: "Token refresh failed",
  refreshMissingToken:
    "Token refresh response did not include an access token",
};

export type InstagramConfig = MetaTokenConfig;

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

export function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<MetaTokenResult> {
  return metaExchangeForLongLivedToken(shortLivedToken, INSTAGRAM_LABELS);
}

export function refreshLongLivedToken(
  currentToken: string
): Promise<MetaTokenResult> {
  return metaRefreshLongLivedToken(currentToken, INSTAGRAM_LABELS);
}

// --- Generic fetch wrapper ---

function igFetch<T>(
  config: InstagramConfig,
  url: string,
  params?: Record<string, string>
): Promise<T> {
  return metaFetch<T>(config, url, INSTAGRAM_LABELS, params);
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
  } catch (error) {
    // Insights may not be available for all post types (e.g., story, album)
    log.debug(`Instagram media insights unavailable for ${mediaId}:`, error);
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
