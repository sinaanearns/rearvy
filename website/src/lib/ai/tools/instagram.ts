import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

type InstagramAccountRecord = Record<string, unknown> & {
  username?: unknown;
  name?: unknown;
  followers_count?: unknown;
  follows_count?: unknown;
  media_count?: unknown;
  biography?: unknown;
};

type InstagramAnalyticsRecord = Record<string, unknown> & {
  metric_date?: unknown;
  follower_count?: unknown;
  impressions?: unknown;
  reach?: unknown;
  profile_views?: unknown;
};

type InstagramPostRecord = Record<string, unknown> & {
  post_id?: unknown;
  caption?: unknown;
  media_type?: unknown;
  permalink?: unknown;
  published_at?: unknown;
  like_count?: unknown;
  comments_count?: unknown;
  reach?: unknown;
  impressions?: unknown;
  engagement?: unknown;
  saved?: unknown;
};

type InstagramCommentRecord = Record<string, unknown> & {
  post_id?: unknown;
  text?: unknown;
  username?: unknown;
  like_count?: unknown;
  published_at?: unknown;
};

function toRecord(data: Record<string, unknown>) {
  return data;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function excerpt(value: unknown, length: number): string | null {
  const text = optionalString(value);
  return text ? text.substring(0, length) : null;
}

function getPostId(post: InstagramPostRecord): string | null {
  return optionalString(post.post_id);
}

function captionIncludes(post: InstagramPostRecord, search: string): boolean {
  return Boolean(optionalString(post.caption)?.toLowerCase().includes(search.toLowerCase()));
}

function engagementRate(post: InstagramPostRecord) {
  const reach = toNumber(post.reach);
  if (reach <= 0) return 0;

  return ((toNumber(post.like_count) + toNumber(post.comments_count)) / reach) * 100;
}

export function getInstagramAccountStats(ctx: ToolContext) {
  return tool({
    description:
      "Get Instagram account overview: followers, following, media count, and recent daily analytics (impressions, reach, profile views)",
    inputSchema: z.object({
      days: z
        .number()
        .optional()
        .default(30)
        .describe("Number of recent days of analytics to include"),
    }),
    execute: async ({ days }) => {
      const accountSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_ACCOUNTS)
        .where("user_id", "==", ctx.userId)
        .limit(1)
        .get();
      const account = accountSnap.docs[0]
        ? (toRecord(accountSnap.docs[0].data() as Record<string, unknown>) as InstagramAccountRecord)
        : null;

      if (!account) {
        return {
          message:
            "No Instagram account found. Connect your Instagram account first.",
        };
      }

      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const analyticsSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_ACCOUNTS + "/analytics")
        .where("user_id", "==", ctx.userId)
        .where("metric_date", ">=", sinceDate)
        .orderBy("metric_date", "asc")
        .get();
      const analytics = analyticsSnap.docs.map((doc) =>
        toRecord(doc.data() as Record<string, unknown>) as InstagramAnalyticsRecord
      );

      const totalImpressions = (analytics || []).reduce(
        (s, d) => s + toNumber(d.impressions),
        0
      );
      const totalReach = (analytics || []).reduce(
        (s, d) => s + toNumber(d.reach),
        0
      );
      const totalProfileViews = (analytics || []).reduce(
        (s, d) => s + toNumber(d.profile_views),
        0
      );

      return {
        username: optionalString(account.username),
        name: optionalString(account.name),
        followersCount: toNumber(account.followers_count),
        followsCount: toNumber(account.follows_count),
        mediaCount: toNumber(account.media_count),
        biography: optionalString(account.biography),
        recentPeriod: {
          days,
          totalImpressions,
          totalReach,
          totalProfileViews,
        },
        dailyData: (analytics || []).map((d) => ({
          date: optionalString(d.metric_date),
          followerCount: toNumber(d.follower_count),
          impressions: toNumber(d.impressions),
          reach: toNumber(d.reach),
          profileViews: toNumber(d.profile_views),
        })),
      };
    },
  });
}

export function getTopInstagramPosts(ctx: ToolContext) {
  return tool({
    description:
      "Get top-performing Instagram posts sorted by likes, comments, or reach",
    inputSchema: z.object({
      sortBy: z
        .enum(["likes", "comments", "reach"])
        .optional()
        .default("likes"),
      limit: z.number().optional().default(10),
      publishedAfter: z
        .string()
        .optional()
        .describe("ISO date to filter posts published after this date"),
    }),
    execute: async ({ sortBy, limit, publishedAfter }) => {
      const columnMap = {
        likes: "like_count",
        comments: "comments_count",
        reach: "reach",
      } as const;

      let query = ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_POSTS)
        .where("user_id", "==", ctx.userId)
        .orderBy(columnMap[sortBy], "desc")
        .limit(limit);

      if (publishedAfter) {
        query = query.where("published_at", ">=", publishedAfter);
      }

      const snapshot = await query.get();
      const data = snapshot.docs.map((doc) =>
        toRecord(doc.data() as Record<string, unknown>) as InstagramPostRecord
      );

      if (!data || data.length === 0) {
        return {
          posts: [],
          message:
            "No posts found. Connect Instagram and sync to see post data.",
        };
      }

      return {
        posts: data.map((p) => ({
          postId: getPostId(p),
          caption: excerpt(p.caption, 150),
          mediaType: optionalString(p.media_type),
          permalink: optionalString(p.permalink),
          publishedAt: optionalString(p.published_at),
          likes: toNumber(p.like_count),
          comments: toNumber(p.comments_count),
          reach: toNumber(p.reach),
          impressions: toNumber(p.impressions),
          engagement: toNumber(p.engagement),
          saved: toNumber(p.saved),
          engagementRate: engagementRate(p),
        })),
      };
    },
  });
}

export function getInstagramPostPerformance(ctx: ToolContext) {
  return tool({
    description:
      "Get detailed performance data for a specific Instagram post by caption search",
    inputSchema: z.object({
      postCaption: z
        .string()
        .describe("Post caption or partial match to search for"),
    }),
    execute: async ({ postCaption }) => {
      const postSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_POSTS)
        .where("user_id", "==", ctx.userId)
        .get();
      const allPosts = postSnap.docs.map((doc) =>
        toRecord(doc.data() as Record<string, unknown>) as InstagramPostRecord
      );
      const data = allPosts.find((p) => captionIncludes(p, postCaption));

      if (!data) {
        return { message: `Post matching "${postCaption}" not found.` };
      }
      const selectedPostId = getPostId(data);
      if (!selectedPostId) {
        return {
          message: `Post matching "${postCaption}" is missing an Instagram post id.`,
        };
      }

      const commentsSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_COMMENTS)
        .where("user_id", "==", ctx.userId)
        .where("post_id", "==", selectedPostId)
        .orderBy("like_count", "desc")
        .limit(5)
        .get();
      const comments = commentsSnap.docs.map((doc) =>
        toRecord(doc.data() as Record<string, unknown>) as InstagramCommentRecord
      );

      const commentCountSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_COMMENTS)
        .where("user_id", "==", ctx.userId)
        .where("post_id", "==", selectedPostId)
        .get();
      const commentCount = commentCountSnap.size;

      return {
        postId: selectedPostId,
        caption: optionalString(data.caption),
        mediaType: optionalString(data.media_type),
        permalink: optionalString(data.permalink),
        publishedAt: optionalString(data.published_at),
        likes: toNumber(data.like_count),
        comments: toNumber(data.comments_count),
        reach: toNumber(data.reach),
        impressions: toNumber(data.impressions),
        engagement: toNumber(data.engagement),
        saved: toNumber(data.saved),
        engagementRate: engagementRate(data),
        topComments: (comments || []).map((c) => ({
          text: excerpt(c.text, 200),
          username: optionalString(c.username),
          likes: toNumber(c.like_count),
          date: optionalString(c.published_at),
        })),
        totalSyncedComments: commentCount || 0,
      };
    },
  });
}

export function getInstagramComments(ctx: ToolContext) {
  return tool({
    description:
      "Get recent Instagram comments across all posts for sentiment analysis. Returns comment text, author, likes, and source post.",
    inputSchema: z.object({
      limit: z.number().optional().default(20),
      postCaption: z
        .string()
        .optional()
        .describe("Filter to comments on a specific post by caption"),
      sortBy: z
        .enum(["recent", "popular"])
        .optional()
        .default("recent"),
    }),
    execute: async ({ limit, postCaption, sortBy }) => {
      let selectedPostId: string | undefined;

      if (postCaption) {
        const postSnap = await ctx.adminDb
          .collection(COLLECTIONS.INSTAGRAM_POSTS)
          .where("user_id", "==", ctx.userId)
          .get();
        const allPosts = postSnap.docs.map((doc) =>
          toRecord(doc.data() as Record<string, unknown>) as InstagramPostRecord
        );
        const matchedPost = allPosts.find((p) => captionIncludes(p, postCaption));
        if (matchedPost) {
          selectedPostId = getPostId(matchedPost) ?? undefined;
        }
      }

      let query = ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_COMMENTS)
        .where("user_id", "==", ctx.userId);

      if (selectedPostId) {
        query = query.where("post_id", "==", selectedPostId);
      }

      if (sortBy === "popular") {
        query = query.orderBy("like_count", "desc");
      } else {
        query = query.orderBy("published_at", "desc");
      }

      query = query.limit(limit);
      const snapshot = await query.get();
      const data = snapshot.docs.map((doc) =>
        toRecord(doc.data() as Record<string, unknown>) as InstagramCommentRecord
      );

      if (!data || data.length === 0) {
        return { comments: [], message: "No comments found." };
      }

      // Enrich with post captions
      const postIds = [
        ...new Set(data.map((c) => optionalString(c.post_id)).filter(Boolean)),
      ];
      if (postIds.length === 0) {
        return {
          comments: data.map((c) => ({
            text: optionalString(c.text),
            username: optionalString(c.username),
            likes: toNumber(c.like_count),
            publishedAt: optionalString(c.published_at),
            postCaption: optionalString(c.post_id),
          })),
        };
      }
      const postsSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_POSTS)
        .where("user_id", "==", ctx.userId)
        .where("post_id", "in", postIds)
        .get();
      const posts = postsSnap.docs.map((doc) =>
        toRecord(doc.data() as Record<string, unknown>) as InstagramPostRecord
      );

      const postCaptionMap = new Map(
        posts
          .map((p) => {
            const id = getPostId(p);
            return id ? [id, excerpt(p.caption, 80) || id] as const : null;
          })
          .filter((entry): entry is readonly [string, string] => Boolean(entry))
      );

      return {
        comments: data.map((c) => ({
          text: optionalString(c.text),
          username: optionalString(c.username),
          likes: toNumber(c.like_count),
          publishedAt: optionalString(c.published_at),
          postCaption: postCaptionMap.get(optionalString(c.post_id) || "") || optionalString(c.post_id),
        })),
      };
    },
  });
}
