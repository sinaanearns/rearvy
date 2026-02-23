import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/utils/encryption";

const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

export interface YouTubeConfig {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

export interface RefreshedTokens {
  accessToken: string;
  expiresAt: Date;
}

// YouTube Data API response types

export interface YouTubeChannelSnippet {
  title: string;
  description: string;
  customUrl?: string;
  publishedAt: string;
  country?: string;
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

export interface YouTubeChannelStatistics {
  viewCount: string;
  subscriberCount: string;
  videoCount: string;
  hiddenSubscriberCount: boolean;
}

export interface YouTubeChannelResource {
  id: string;
  snippet: YouTubeChannelSnippet;
  statistics: YouTubeChannelStatistics;
  contentDetails: {
    relatedPlaylists: {
      uploads: string;
    };
  };
}

export interface YouTubeVideoSnippet {
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  categoryId?: string;
  tags?: string[];
  thumbnails?: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
  };
}

export interface YouTubeVideoStatistics {
  viewCount: string;
  likeCount: string;
  commentCount: string;
  favoriteCount: string;
}

export interface YouTubeVideoResource {
  id: string;
  snippet: YouTubeVideoSnippet;
  statistics: YouTubeVideoStatistics;
  contentDetails: {
    duration: string;
  };
  status: {
    privacyStatus: "public" | "private" | "unlisted";
  };
}

export interface YouTubeCommentSnippet {
  authorDisplayName: string;
  authorChannelId?: { value: string };
  authorProfileImageUrl?: string;
  textDisplay: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
}

export interface YouTubeCommentThread {
  id: string;
  snippet: {
    topLevelComment: {
      id: string;
      snippet: YouTubeCommentSnippet;
    };
    totalReplyCount: number;
  };
}

export interface YouTubeAnalyticsResponse {
  columnHeaders: { name: string; columnType: string; dataType: string }[];
  rows: (string | number)[][];
}

// Token refresh

export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshedTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function ensureFreshToken(config: YouTubeConfig): Promise<string> {
  // Refresh if token expires within 5 minutes
  if (config.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(config.refreshToken);
    config.accessToken = refreshed.accessToken;
    config.tokenExpiresAt = refreshed.expiresAt;
  }
  return config.accessToken;
}

async function youtubeFetch<T>(
  config: YouTubeConfig,
  url: string,
  params?: Record<string, string>
): Promise<T> {
  const token = await ensureFreshToken(config);
  const u = new URL(url);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, v);
    }
  }

  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// Data API functions

export async function getChannelInfo(
  config: YouTubeConfig
): Promise<YouTubeChannelResource> {
  const data = await youtubeFetch<{ items: YouTubeChannelResource[] }>(
    config,
    `${YOUTUBE_DATA_API}/channels`,
    {
      part: "snippet,statistics,contentDetails",
      mine: "true",
    }
  );

  if (!data.items || data.items.length === 0) {
    throw new Error("No YouTube channel found for this account");
  }

  return data.items[0];
}

export async function getChannelVideos(
  config: YouTubeConfig,
  channelId: string,
  pageToken?: string
): Promise<{ videos: YouTubeVideoResource[]; nextPageToken?: string }> {
  // First get video IDs via search
  const searchParams: Record<string, string> = {
    part: "id",
    channelId,
    type: "video",
    order: "date",
    maxResults: "50",
  };
  if (pageToken) searchParams.pageToken = pageToken;

  const searchData = await youtubeFetch<{
    items: { id: { videoId: string } }[];
    nextPageToken?: string;
  }>(config, `${YOUTUBE_DATA_API}/search`, searchParams);

  if (!searchData.items || searchData.items.length === 0) {
    return { videos: [], nextPageToken: undefined };
  }

  // Batch fetch video details
  const videoIds = searchData.items.map((item) => item.id.videoId).join(",");
  const videoData = await youtubeFetch<{ items: YouTubeVideoResource[] }>(
    config,
    `${YOUTUBE_DATA_API}/videos`,
    {
      part: "snippet,statistics,contentDetails,status",
      id: videoIds,
    }
  );

  return {
    videos: videoData.items || [],
    nextPageToken: searchData.nextPageToken,
  };
}

export async function getVideoComments(
  config: YouTubeConfig,
  videoId: string,
  pageToken?: string
): Promise<{ comments: YouTubeCommentThread[]; nextPageToken?: string }> {
  const params: Record<string, string> = {
    part: "snippet",
    videoId,
    maxResults: "100",
    order: "time",
  };
  if (pageToken) params.pageToken = pageToken;

  const data = await youtubeFetch<{
    items: YouTubeCommentThread[];
    nextPageToken?: string;
  }>(config, `${YOUTUBE_DATA_API}/commentThreads`, params);

  return {
    comments: data.items || [],
    nextPageToken: data.nextPageToken,
  };
}

// Analytics API

export async function getChannelAnalytics(
  config: YouTubeConfig,
  startDate: string,
  endDate: string
): Promise<YouTubeAnalyticsResponse> {
  return youtubeFetch<YouTubeAnalyticsResponse>(
    config,
    `${YOUTUBE_ANALYTICS_API}/reports`,
    {
      ids: "channel==MINE",
      startDate,
      endDate,
      metrics:
        "views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,dislikes,comments,shares,averageViewDuration,impressions,impressionClickThroughRate",
      dimensions: "day",
      sort: "day",
    }
  );
}

// Token persistence

export async function persistRefreshedTokens(
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
