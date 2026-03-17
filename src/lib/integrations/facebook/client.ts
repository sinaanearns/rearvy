import type { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export interface FacebookConfig {
  accessToken: string;
  tokenExpiresAt: Date;
}

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
    throw new Error(`Facebook long-lived token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000,
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
    throw new Error(`Facebook token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000,
  };
}

async function ensureFreshToken(config: FacebookConfig): Promise<string> {
  if (config.tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
    const refreshed = await refreshLongLivedToken(config.accessToken);
    config.accessToken = refreshed.accessToken;
    config.tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  }
  return config.accessToken;
}

// --- Generic fetch wrapper ---

async function fbFetch<T>(
  config: FacebookConfig,
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
    throw new Error(`Facebook API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
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
    const data = await fbFetch<{ data: any[] }>(
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
  } catch {
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

// --- Token persistence ---

export async function persistRefreshedToken(
  db: Firestore,
  integrationId: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> {
  const { encrypted, iv } = encrypt(accessToken);
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({
      access_token_enc: encrypted,
      token_iv: iv,
      token_expires_at: expiresAt.toISOString(),
    });
}
