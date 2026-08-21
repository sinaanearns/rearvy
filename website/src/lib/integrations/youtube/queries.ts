import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";

type SortDirection = "asc" | "desc";

export type YouTubeChannelRecord = Record<string, unknown> & {
  user_id: string;
  channel_id: string;
  title?: string | null;
  description?: string | null;
  custom_url?: string | null;
  thumbnail_url?: string | null;
  country?: string | null;
  published_at?: string | null;
  subscriber_count?: number;
  video_count?: number;
  view_count?: number;
  synced_at?: string | null;
};

export type YouTubeVideoRecord = Record<string, unknown> & {
  user_id: string;
  integration_id?: string | null;
  channel_id?: string | null;
  video_id: string;
  title?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  published_at?: string | null;
  duration?: string | null;
  tags?: string[] | null;
  synced_at?: string | null;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
};

export type YouTubeAnalyticsRecord = Record<string, unknown> & {
  user_id: string;
  integration_id?: string | null;
  channel_id?: string | null;
  metric_date: string;
};

export type YouTubeCommentRecord = Record<string, unknown> & {
  user_id: string;
  video_id: string;
  author_name?: string | null;
  text_display?: string | null;
  published_at?: string | null;
  like_count?: number;
  reply_count?: number;
};

type GetVideosOptions = {
  channelId?: string | null;
  integrationId?: string | null;
  publishedAfter?: string;
  sortBy?: "published_at" | "synced_at" | "view_count" | "like_count" | "comment_count";
  sortDirection?: SortDirection;
  limit?: number;
};

type GetAnalyticsOptions = {
  channelId?: string | null;
  integrationId?: string | null;
  sinceDate?: string;
  sortDirection?: SortDirection;
  limit?: number;
};

type GetCommentsOptions = {
  videoId?: string;
  sortBy?: "published_at" | "like_count";
  sortDirection?: SortDirection;
  limit?: number;
};

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSortableString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function compareStrings(
  left: unknown,
  right: unknown,
  direction: SortDirection
): number {
  const leftValue = toSortableString(left);
  const rightValue = toSortableString(right);

  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return 1;
  if (!rightValue) return -1;

  return direction === "asc"
    ? leftValue.localeCompare(rightValue)
    : rightValue.localeCompare(leftValue);
}

function compareNumbers(
  left: unknown,
  right: unknown,
  direction: SortDirection
): number {
  const leftValue = toNumber(left);
  const rightValue = toNumber(right);

  return direction === "asc"
    ? leftValue - rightValue
    : rightValue - leftValue;
}

export async function getYouTubeChannelsForUser(
  db: Firestore,
  userId: string
): Promise<YouTubeChannelRecord[]> {
  const snapshot = await db
    .collection(COLLECTIONS.YOUTUBE_CHANNELS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs.map((doc) => doc.data() as YouTubeChannelRecord);
}

export async function findYouTubeChannelForUser(
  db: Firestore,
  userId: string,
  channelId?: string | null
): Promise<YouTubeChannelRecord | undefined> {
  const channels = await getYouTubeChannelsForUser(db, userId);

  if (channelId) {
    return channels.find((channel) => channel.channel_id === channelId);
  }

  return channels[0];
}

export async function getYouTubeVideosForUser(
  db: Firestore,
  userId: string,
  options: GetVideosOptions = {}
): Promise<YouTubeVideoRecord[]> {
  const snapshot = await db
    .collection(COLLECTIONS.YOUTUBE_VIDEOS)
    .where("user_id", "==", userId)
    .get();

  let videos = snapshot.docs.map((doc) => doc.data() as YouTubeVideoRecord);

  if (options.channelId) {
    videos = videos.filter((video) => video.channel_id === options.channelId);
  }

  if (options.integrationId) {
    videos = videos.filter(
      (video) => video.integration_id === options.integrationId
    );
  }

  if (options.publishedAfter) {
    videos = videos.filter((video) => {
      const publishedAt = toSortableString(video.published_at);
      return Boolean(publishedAt) && publishedAt >= options.publishedAfter!;
    });
  }

  const sortBy = options.sortBy ?? "published_at";
  const sortDirection = options.sortDirection ?? "desc";

  videos.sort((left, right) => {
    if (
      sortBy === "view_count" ||
      sortBy === "like_count" ||
      sortBy === "comment_count"
    ) {
      return compareNumbers(left[sortBy], right[sortBy], sortDirection);
    }

    return compareStrings(left[sortBy], right[sortBy], sortDirection);
  });

  if (typeof options.limit === "number") {
    videos = videos.slice(0, options.limit);
  }

  return videos;
}

export async function getYouTubeAnalyticsForUser(
  db: Firestore,
  userId: string,
  options: GetAnalyticsOptions = {}
): Promise<YouTubeAnalyticsRecord[]> {
  const snapshot = await db
    .collection(COLLECTIONS.YOUTUBE_ANALYTICS)
    .where("user_id", "==", userId)
    .get();

  let analytics = snapshot.docs.map(
    (doc) => doc.data() as YouTubeAnalyticsRecord
  );

  if (options.channelId) {
    analytics = analytics.filter(
      (entry) => entry.channel_id === options.channelId
    );
  }

  if (options.integrationId) {
    analytics = analytics.filter(
      (entry) => entry.integration_id === options.integrationId
    );
  }

  if (options.sinceDate) {
    analytics = analytics.filter((entry) => entry.metric_date >= options.sinceDate!);
  }

  analytics.sort((left, right) =>
    compareStrings(
      left.metric_date,
      right.metric_date,
      options.sortDirection ?? "asc"
    )
  );

  if (typeof options.limit === "number") {
    analytics = analytics.slice(0, options.limit);
  }

  return analytics;
}

export async function getYouTubeCommentsForUser(
  db: Firestore,
  userId: string,
  options: GetCommentsOptions = {}
): Promise<YouTubeCommentRecord[]> {
  const snapshot = await db
    .collection(COLLECTIONS.YOUTUBE_COMMENTS)
    .where("user_id", "==", userId)
    .get();

  let comments = snapshot.docs.map((doc) => doc.data() as YouTubeCommentRecord);

  if (options.videoId) {
    comments = comments.filter((comment) => comment.video_id === options.videoId);
  }

  const sortBy = options.sortBy ?? "published_at";
  const sortDirection = options.sortDirection ?? "desc";

  comments.sort((left, right) => {
    if (sortBy === "like_count") {
      return compareNumbers(left.like_count, right.like_count, sortDirection);
    }

    return compareStrings(left.published_at, right.published_at, sortDirection);
  });

  if (typeof options.limit === "number") {
    comments = comments.slice(0, options.limit);
  }

  return comments;
}
