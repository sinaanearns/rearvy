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

const log = createServerLogger("FacebookClient");

const FACEBOOK_LABELS: MetaPlatformLabels = {
  apiLabel: "Facebook",
  exchangeFailure: "Facebook long-lived token exchange failed",
  exchangeMissingToken:
    "Facebook long-lived token exchange response did not include an access token",
  refreshFailure: "Facebook token refresh failed",
  refreshMissingToken:
    "Facebook token refresh response did not include an access token",
};

export type FacebookConfig = MetaTokenConfig;

export interface FBPageData {
  id: string;
  name: string;
  access_token: string; // Page access token
  category?: string;
  about?: string;
  description?: string;
  link?: string;
  picture?: { data: { url: string } };
  fan_count?: number;
  followers_count?: number;
}

export interface FBPostItem {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count: number };
}

export interface FBPostInsights {
  impressions?: number;
  reach?: number;
  engagement?: number;
}

export interface FBPageInsightValue {
  value: number;
  end_time: string;
}

export interface FBPageInsight {
  name: string;
  period: string;
  values: FBPageInsightValue[];
}

export interface FBComment {
  id: string;
  message: string;
  from?: { name: string; id: string };
  created_time: string;
  like_count?: number;
}

// --- Token management ---

export function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<MetaTokenResult> {
  return metaExchangeForLongLivedToken(shortLivedToken, FACEBOOK_LABELS);
}

export function refreshLongLivedToken(
  currentToken: string
): Promise<MetaTokenResult> {
  return metaRefreshLongLivedToken(currentToken, FACEBOOK_LABELS);
}

// --- Generic fetch wrapper ---

function fbFetch<T>(
  config: FacebookConfig,
  url: string,
  params?: Record<string, string>
): Promise<T> {
  return metaFetch<T>(config, url, FACEBOOK_LABELS, params);
}

// --- API methods ---

export async function getUserPages(
  config: FacebookConfig
): Promise<FBPageData[]> {
  const data = await fbFetch<{
    data: FBPageData[];
  }>(config, `${GRAPH_API}/me/accounts`, {
    fields: "id,name,access_token,category,about,description,link,picture,fan_count,followers_count",
  });

  return data.data || [];
}

export async function getPagePosts(
  pageConfig: FacebookConfig,
  pageId: string,
  after?: string
): Promise<{ posts: FBPostItem[]; nextCursor?: string }> {
  const params: Record<string, string> = {
    fields: "id,message,created_time,permalink_url,full_picture,shares",
    limit: "50",
  };
  if (after) params.after = after;

  const data = await fbFetch<{
    data: FBPostItem[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(pageConfig, `${GRAPH_API}/${pageId}/published_posts`, params);

  return {
    posts: data.data || [],
    nextCursor: data.paging?.next ? data.paging.cursors?.after : undefined,
  };
}

export async function getPostInsights(
  pageConfig: FacebookConfig,
  postId: string
): Promise<FBPostInsights> {
  try {
    const data = await fbFetch<{ data: FBPageInsight[] }>(
      pageConfig,
      `${GRAPH_API}/${postId}/insights`,
      { metric: "post_impressions,post_reach,post_engagements" }
    );

    const result: Record<string, number> = {};
    for (const metric of data.data || []) {
      result[metric.name] = metric.values?.[0]?.value || 0;
    }

    return {
      impressions: result.post_impressions,
      reach: result.post_reach,
      engagement: result.post_engagements,
    };
  } catch (error) {
    log.debug(`Facebook post insights unavailable for ${postId}:`, error);
    return {};
  }
}

export async function getPageInsights(
  pageConfig: FacebookConfig,
  pageId: string,
  since: number,
  until: number
): Promise<FBPageInsight[]> {
  const data = await fbFetch<{ data: FBPageInsight[] }>(
    pageConfig,
    `${GRAPH_API}/${pageId}/insights`,
    {
      metric: "page_impressions,page_engaged_users,page_total_actions",
      period: "day",
      since: String(since),
      until: String(until),
    }
  );

  return data.data || [];
}

export async function getComments(
  pageConfig: FacebookConfig,
  objectId: string,
  after?: string
): Promise<{ comments: FBComment[]; nextCursor?: string }> {
  const params: Record<string, string> = {
    fields: "id,message,from,created_time,like_count",
    limit: "50",
  };
  if (after) params.after = after;

  const data = await fbFetch<{
    data: FBComment[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(pageConfig, `${GRAPH_API}/${objectId}/comments`, params);

  return {
    comments: data.data || [],
    nextCursor: data.paging?.next ? data.paging.cursors?.after : undefined,
  };
}
