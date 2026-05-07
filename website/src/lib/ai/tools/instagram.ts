import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

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
      const account = accountSnap.docs[0]?.data() as any;

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
      const analytics = analyticsSnap.docs.map((doc) => doc.data() as any);

      const totalImpressions = (analytics || []).reduce(
        (s, d) => s + Number(d.impressions || 0),
        0
      );
      const totalReach = (analytics || []).reduce(
        (s, d) => s + Number(d.reach || 0),
        0
      );
      const totalProfileViews = (analytics || []).reduce(
        (s, d) => s + Number(d.profile_views || 0),
        0
      );

      return {
        username: account.username,
        name: account.name,
        followersCount: account.followers_count,
        followsCount: account.follows_count,
        mediaCount: account.media_count,
        biography: account.biography,
        recentPeriod: {
          days,
          totalImpressions,
          totalReach,
          totalProfileViews,
        },
        dailyData: (analytics || []).map((d) => ({
          date: d.metric_date,
          followerCount: Number(d.follower_count || 0),
          impressions: Number(d.impressions || 0),
          reach: Number(d.reach || 0),
          profileViews: Number(d.profile_views || 0),
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
      const data = snapshot.docs.map((doc) => doc.data() as any);

      if (!data || data.length === 0) {
        return {
          posts: [],
          message:
            "No posts found. Connect Instagram and sync to see post data.",
        };
      }

      return {
        posts: data.map((p: any) => ({
          postId: p.post_id,
          caption: p.caption?.substring(0, 150),
          mediaType: p.media_type,
          permalink: p.permalink,
          publishedAt: p.published_at,
          likes: Number(p.like_count),
          comments: Number(p.comments_count),
          reach: Number(p.reach || 0),
          impressions: Number(p.impressions || 0),
          engagement: Number(p.engagement || 0),
          saved: Number(p.saved || 0),
          engagementRate:
            Number(p.reach || 0) > 0
              ? ((Number(p.like_count) + Number(p.comments_count)) /
                  Number(p.reach)) *
                100
              : 0,
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
      const allPosts = postSnap.docs.map((doc) => doc.data() as any);
      const data = allPosts.find((p: any) =>
        p.caption?.toLowerCase().includes(postCaption.toLowerCase())
      );

      if (!data) {
        return { message: `Post matching "${postCaption}" not found.` };
      }

      const commentsSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_COMMENTS)
        .where("user_id", "==", ctx.userId)
        .where("post_id", "==", data.post_id)
        .orderBy("like_count", "desc")
        .limit(5)
        .get();
      const comments = commentsSnap.docs.map((doc) => doc.data() as any);

      const commentCountSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_COMMENTS)
        .where("user_id", "==", ctx.userId)
        .where("post_id", "==", data.post_id)
        .get();
      const commentCount = commentCountSnap.size;

      return {
        postId: data.post_id,
        caption: data.caption,
        mediaType: data.media_type,
        permalink: data.permalink,
        publishedAt: data.published_at,
        likes: Number(data.like_count),
        comments: Number(data.comments_count),
        reach: Number(data.reach || 0),
        impressions: Number(data.impressions || 0),
        engagement: Number(data.engagement || 0),
        saved: Number(data.saved || 0),
        engagementRate:
          Number(data.reach || 0) > 0
            ? ((Number(data.like_count) + Number(data.comments_count)) /
                Number(data.reach)) *
              100
            : 0,
        topComments: (comments || []).map((c: any) => ({
          text: c.text?.substring(0, 200),
          username: c.username,
          likes: c.like_count,
          date: c.published_at,
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
      let postId: string | undefined;

      if (postCaption) {
        const postSnap = await ctx.adminDb
          .collection(COLLECTIONS.INSTAGRAM_POSTS)
          .where("user_id", "==", ctx.userId)
          .get();
        const allPosts = postSnap.docs.map((doc) => doc.data() as any);
        const matchedPost = allPosts.find((p: any) =>
          p.caption?.toLowerCase().includes(postCaption.toLowerCase())
        );
        if (matchedPost) {
          postId = matchedPost.post_id;
        }
      }

      let query = ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_COMMENTS)
        .where("user_id", "==", ctx.userId);

      if (postId) {
        query = query.where("post_id", "==", postId);
      }

      if (sortBy === "popular") {
        query = query.orderBy("like_count", "desc");
      } else {
        query = query.orderBy("published_at", "desc");
      }

      query = query.limit(limit);
      const snapshot = await query.get();
      const data = snapshot.docs.map((doc) => doc.data() as any);

      if (!data || data.length === 0) {
        return { comments: [], message: "No comments found." };
      }

      // Enrich with post captions
      const postIds = [...new Set(data.map((c: any) => c.post_id))];
      const postsSnap = await ctx.adminDb
        .collection(COLLECTIONS.INSTAGRAM_POSTS)
        .where("user_id", "==", ctx.userId)
        .where("post_id", "in", postIds)
        .get();
      const posts = postsSnap.docs.map((doc) => doc.data() as any);

      const postCaptionMap = new Map(
        (posts || []).map((p: any) => [p.post_id, p.caption?.substring(0, 80)])
      );

      return {
        comments: data.map((c: any) => ({
          text: c.text,
          username: c.username,
          likes: c.like_count,
          publishedAt: c.published_at,
          postCaption: postCaptionMap.get(c.post_id) || c.post_id,
        })),
      };
    },
  });
}
