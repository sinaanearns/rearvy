import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/utils/encryption";

const TIKTOK_API = "https://open.tiktokapis.com";

export interface TikTokConfig {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

// --- API response types ---

export interface TikTokUserInfo {
  open_id: string;
  union_id?: string;
  display_name?: string;
  avatar_url?: string;
  bio_description?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
}

export interface TikTokVideoItem {
  id: string;
  title?: string;
  description?: string;
  create_time: number; // Unix timestamp
  cover_image_url?: string;
  share_url?: string;
  duration: number; // seconds
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
}

// --- Token management ---

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}> {
  const res = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`TikTok token refresh error: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    refreshExpiresIn: data.refresh_expires_in,
  };
}

async function ensureFreshToken(config: TikTokConfig): Promise<string> {
  if (config.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(config.refreshToken);
    config.accessToken = refreshed.accessToken;
    config.refreshToken = refreshed.refreshToken;
    config.tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  }
  return config.accessToken;
}

// --- Generic fetch wrapper ---

async function tiktokFetch<T>(
  config: TikTokConfig,
  url: string,
  options?: { method?: string; params?: Record<string, string>; body?: unknown }
): Promise<T> {
  const token = await ensureFreshToken(config);
  const u = new URL(url);
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) {
      u.searchParams.set(k, v);
    }
  }

  const fetchOptions: RequestInit = {
    method: options?.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (options?.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(u.toString(), fetchOptions);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- API methods ---

export async function getUserInfo(
  config: TikTokConfig
): Promise<TikTokUserInfo> {
  const data = await tiktokFetch<{
    data: { user: TikTokUserInfo };
    error: { code: string; message: string };
  }>(config, `${TIKTOK_API}/v2/user/info/`, {
    params: {
      fields:
        "open_id,union_id,display_name,avatar_url,bio_description,follower_count,following_count,likes_count,video_count",
    },
  });

  if (data.error?.code && data.error.code !== "ok") {
    throw new Error(`TikTok user info error: ${data.error.message}`);
  }

  return data.data.user;
}

export async function getVideos(
  config: TikTokConfig,
  cursor?: number,
  maxCount: number = 20
): Promise<{ videos: TikTokVideoItem[]; cursor?: number; hasMore: boolean }> {
  const body: Record<string, unknown> = { max_count: maxCount };
  if (cursor) body.cursor = cursor;

  const data = await tiktokFetch<{
    data: {
      videos: TikTokVideoItem[];
      cursor?: number;
      has_more: boolean;
    };
    error: { code: string; message: string };
  }>(config, `${TIKTOK_API}/v2/video/list/`, {
    method: "POST",
    params: {
      fields:
        "id,title,description,create_time,cover_image_url,share_url,duration,like_count,comment_count,share_count,view_count",
    },
    body,
  });

  if (data.error?.code && data.error.code !== "ok") {
    throw new Error(`TikTok video list error: ${data.error.message}`);
  }

  return {
    videos: data.data.videos || [],
    cursor: data.data.cursor,
    hasMore: data.data.has_more,
  };
}

// --- Token persistence ---

export async function persistRefreshedTokens(
  supabase: SupabaseClient,
  integrationId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  const { encrypted: accessEnc, iv: accessIv } = encrypt(accessToken);
  const { encrypted: refreshEnc, iv: refreshIv } = encrypt(refreshToken);

  await supabase
    .from("integrations")
    .update({
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      token_iv: accessIv,
      token_expires_at: expiresAt.toISOString(),
      sync_cursor: { refresh_iv: refreshIv },
    })
    .eq("id", integrationId);
}
