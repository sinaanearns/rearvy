import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

export function getYouTubeChannelStats(ctx: ToolContext) {
  return tool({
    description:
      "Get YouTube channel overview: subscribers, total views, video count, and recent daily analytics",
    inputSchema: z.object({
      days: z
        .number()
        .optional()
        .default(30)
        .describe("Number of recent days of analytics to include"),
    }),
    execute: async ({ days }) => {
      const channelSnap = await ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_CHANNELS)
        .where("user_id", "==", ctx.userId)
        .limit(1)
        .get();
      const channel = channelSnap.docs[0]?.data() as any;

      if (!channel) {
        return {
          message:
            "No YouTube channel found. Connect your YouTube account first.",
        };
      }

      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const analyticsSnap = await ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_CHANNELS + "/analytics")
        .where("user_id", "==", ctx.userId)
        .where("metric_date", ">=", sinceDate)
        .orderBy("metric_date", "asc")
        .get();
      const analytics = analyticsSnap.docs.map((doc) => doc.data() as any);

      const totalViews = (analytics || []).reduce(
        (s, d) => s + Number(d.views),
        0
      );
      const totalWatchMinutes = (analytics || []).reduce(
        (s, d) => s + Number(d.estimated_minutes_watched),
        0
      );
      const netSubscribers = (analytics || []).reduce(
        (s, d) =>
          s + Number(d.subscribers_gained) - Number(d.subscribers_lost),
        0
      );

      return {
        channelTitle: channel.title,
        subscriberCount: channel.subscriber_count,
        totalVideoCount: channel.video_count,
        lifetimeViews: channel.view_count,
        recentPeriod: { days, totalViews, totalWatchMinutes, netSubscribers },
        dailyData: (analytics || []).map((d) => ({
          date: d.metric_date,
          views: Number(d.views),
          watchMinutes: Number(d.estimated_minutes_watched),
          subscribersNet:
            Number(d.subscribers_gained) - Number(d.subscribers_lost),
          likes: Number(d.likes),
          comments: Number(d.comments),
          shares: Number(d.shares),
        })),
      };
    },
  });
}

export function getTopYouTubeVideos(ctx: ToolContext) {
  return tool({
    description:
      "Get top-performing YouTube videos sorted by views, likes, or comments",
    inputSchema: z.object({
      sortBy: z
        .enum(["views", "likes", "comments"])
        .optional()
        .default("views"),
      limit: z.number().optional().default(10),
      publishedAfter: z
        .string()
        .optional()
        .describe("ISO date to filter videos published after this date"),
    }),
    execute: async ({ sortBy, limit, publishedAfter }) => {
      const columnMap = {
        views: "view_count",
        likes: "like_count",
        comments: "comment_count",
      } as const;

      let query = ctx.supabase
        .from("youtube_videos")
        .select(
          "video_id, title, published_at, view_count, like_count, comment_count, thumbnail_url, duration"
        )
        .eq("user_id", ctx.userId)
        .order(columnMap[sortBy], { ascending: false })
        .limit(limit);

      if (publishedAfter) {
        query = query.gte("published_at", publishedAfter);
      }

      const { data } = await query;

      if (!data || data.length === 0) {
        return {
          videos: [],
          message:
            "No videos found. Connect YouTube and sync to see video data.",
        };
      }

      return {
        videos: data.map((v) => ({
          videoId: v.video_id,
          title: v.title,
          publishedAt: v.published_at,
          views: Number(v.view_count),
          likes: Number(v.like_count),
          comments: Number(v.comment_count),
          thumbnailUrl: v.thumbnail_url,
          duration: v.duration,
          engagementRate:
            Number(v.view_count) > 0
              ? ((Number(v.like_count) + Number(v.comment_count)) /
                  Number(v.view_count)) *
                100
              : 0,
        })),
      };
    },
  });
}

export function getYouTubeVideoPerformance(ctx: ToolContext) {
  return tool({
    description:
      "Get detailed performance data for a specific YouTube video by title search",
    inputSchema: z.object({
      videoTitle: z
        .string()
        .describe("Video title or partial match to search for"),
    }),
    execute: async ({ videoTitle }) => {
      const { data } = await ctx.supabase
        .from("youtube_videos")
        .select("*")
        .eq("user_id", ctx.userId)
        .ilike("title", `%${videoTitle}%`)
        .limit(1)
        .single();

      if (!data) {
        return { message: `Video matching "${videoTitle}" not found.` };
      }

      // Also fetch top comments for this video
      const { data: comments, count: commentCount } = await ctx.supabase
        .from("youtube_comments")
        .select("text_display, author_name, like_count, published_at", {
          count: "exact",
        })
        .eq("user_id", ctx.userId)
        .eq("video_id", data.video_id)
        .order("like_count", { ascending: false })
        .limit(5);

      return {
        videoId: data.video_id,
        title: data.title,
        description: data.description?.substring(0, 500),
        publishedAt: data.published_at,
        duration: data.duration,
        views: Number(data.view_count),
        likes: Number(data.like_count),
        comments: Number(data.comment_count),
        engagementRate:
          Number(data.view_count) > 0
            ? ((Number(data.like_count) + Number(data.comment_count)) /
                Number(data.view_count)) *
              100
            : 0,
        tags: data.tags,
        topComments: (comments || []).map((c) => ({
          author: c.author_name,
          text: c.text_display?.substring(0, 200),
          likes: c.like_count,
          date: c.published_at,
        })),
        totalSyncedComments: commentCount || 0,
      };
    },
  });
}

export function getYouTubeComments(ctx: ToolContext) {
  return tool({
    description:
      "Get recent YouTube comments across all videos for sentiment analysis. Returns comment text, author, likes, and source video.",
    inputSchema: z.object({
      limit: z.number().optional().default(20),
      videoTitle: z
        .string()
        .optional()
        .describe("Filter to comments on a specific video"),
      sortBy: z
        .enum(["recent", "popular"])
        .optional()
        .default("recent"),
    }),
    execute: async ({ limit, videoTitle, sortBy }) => {
      let query = ctx.supabase
        .from("youtube_comments")
        .select(
          "comment_id, video_id, text_display, author_name, like_count, reply_count, published_at"
        )
        .eq("user_id", ctx.userId);

      if (videoTitle) {
        const { data: video } = await ctx.supabase
          .from("youtube_videos")
          .select("video_id")
          .eq("user_id", ctx.userId)
          .ilike("title", `%${videoTitle}%`)
          .single();

        if (video) {
          query = query.eq("video_id", video.video_id);
        }
      }

      if (sortBy === "popular") {
        query = query.order("like_count", { ascending: false });
      } else {
        query = query.order("published_at", { ascending: false });
      }

      query = query.limit(limit);
      const { data } = await query;

      if (!data || data.length === 0) {
        return { comments: [], message: "No comments found." };
      }

      // Enrich with video titles
      const videoIds = [...new Set(data.map((c) => c.video_id))];
      const { data: videos } = await ctx.supabase
        .from("youtube_videos")
        .select("video_id, title")
        .eq("user_id", ctx.userId)
        .in("video_id", videoIds);

      const videoTitleMap = new Map(
        (videos || []).map((v) => [v.video_id, v.title])
      );

      return {
        comments: data.map((c) => ({
          text: c.text_display,
          author: c.author_name,
          likes: c.like_count,
          replies: c.reply_count,
          publishedAt: c.published_at,
          videoTitle: videoTitleMap.get(c.video_id) || c.video_id,
        })),
      };
    },
  });
}
