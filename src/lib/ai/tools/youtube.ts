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
        .collection(COLLECTIONS.YOUTUBE_ANALYTICS)
        .where("user_id", "==", ctx.userId)
        .where("channel_id", "==", channel.channel_id)
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

      let query = ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_VIDEOS)
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
          videos: [],
          message:
            "No videos found. Connect YouTube and sync to see video data.",
        };
      }

      return {
        videos: data.map((v: any) => ({
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
      const videoSnap = await ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_VIDEOS)
        .where("user_id", "==", ctx.userId)
        .get();
      const allVideos = videoSnap.docs.map((doc) => doc.data() as any);
      const data = allVideos.find((v: any) =>
        v.title?.toLowerCase().includes(videoTitle.toLowerCase())
      );

      if (!data) {
        return { message: `Video matching "${videoTitle}" not found.` };
      }

      const commentsSnap = await ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_COMMENTS)
        .where("user_id", "==", ctx.userId)
        .where("video_id", "==", data.video_id)
        .orderBy("like_count", "desc")
        .limit(5)
        .get();
      const comments = commentsSnap.docs.map((doc) => doc.data() as any);

      const commentCountSnap = await ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_COMMENTS)
        .where("user_id", "==", ctx.userId)
        .where("video_id", "==", data.video_id)
        .get();
      const commentCount = commentCountSnap.size;

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
        topComments: (comments || []).map((c: any) => ({
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
      let videoId: string | undefined;

      if (videoTitle) {
        const videoSnap = await ctx.adminDb
          .collection(COLLECTIONS.YOUTUBE_VIDEOS)
          .where("user_id", "==", ctx.userId)
          .get();
        const allVideos = videoSnap.docs.map((doc) => doc.data() as any);
        const matchedVideo = allVideos.find((v: any) =>
          v.title?.toLowerCase().includes(videoTitle.toLowerCase())
        );
        if (matchedVideo) {
          videoId = matchedVideo.video_id;
        }
      }

      let query = ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_COMMENTS)
        .where("user_id", "==", ctx.userId);

      if (videoId) {
        query = query.where("video_id", "==", videoId);
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

      // Enrich with video titles
      const videoIds = [...new Set(data.map((c: any) => c.video_id))];
      const videosSnap = await ctx.adminDb
        .collection(COLLECTIONS.YOUTUBE_VIDEOS)
        .where("user_id", "==", ctx.userId)
        .where("video_id", "in", videoIds)
        .get();
      const videos = videosSnap.docs.map((doc) => doc.data() as any);

      const videoTitleMap = new Map(
        (videos || []).map((v: any) => [v.video_id, v.title])
      );

      return {
        comments: data.map((c: any) => ({
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
