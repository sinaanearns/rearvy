import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { getYouTubeSchemaHealth } from "@/lib/integrations/schema-health";

const YOUTUBE_SCHEMA_ERROR_CODE = "YOUTUBE_SCHEMA_MISSING";

type ReadyResult = {
  error?: {
    ok: false;
    errorCode: string;
    message: string;
    action?: string;
  };
};

function schemaMissingError(missingTables: string[]) {
  return {
    ok: false as const,
    errorCode: YOUTUBE_SCHEMA_ERROR_CODE,
    message: `YouTube data is unavailable because required tables are missing: ${missingTables.join(", ")}.`,
    action: "Run the pending Supabase migrations and sync YouTube again.",
  };
}

async function ensureYouTubeDataReady(ctx: ToolContext): Promise<ReadyResult> {
  const schemaHealth = await getYouTubeSchemaHealth(ctx.supabase);
  if (!schemaHealth.ok) {
    return {
      error: schemaMissingError(schemaHealth.missingTables),
    };
  }

  const { data: integration, error: integrationError } = await ctx.supabase
    .from("integrations")
    .select("status, last_synced_at")
    .eq("user_id", ctx.userId)
    .eq("provider", "youtube")
    .maybeSingle();

  if (integrationError) {
    return {
      error: {
        ok: false,
        errorCode: "YOUTUBE_INTEGRATION_QUERY_FAILED",
        message: "Failed to check YouTube integration status.",
        action: "Retry in a moment.",
      },
    };
  }

  if (!integration) {
    return {
      error: {
        ok: false,
        errorCode: "YOUTUBE_NOT_CONNECTED",
        message: "YouTube integration is not connected.",
        action: "Connect YouTube in Integrations.",
      },
    };
  }

  if (integration.status !== "active") {
    return {
      error: {
        ok: false,
        errorCode: "YOUTUBE_INTEGRATION_NOT_ACTIVE",
        message: `YouTube integration is ${integration.status}.`,
        action: "Reconnect YouTube and run a sync.",
      },
    };
  }

  return {};
}

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
      const readiness = await ensureYouTubeDataReady(ctx);
      if (readiness.error) return readiness.error;

      const clampedDays = Math.min(Math.max(days, 1), 365);
      const { data: channel, error: channelError } = await ctx.supabase
        .from("youtube_channels")
        .select("*")
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (channelError) {
        return {
          ok: false,
          errorCode: "YOUTUBE_CHANNEL_QUERY_FAILED",
          message: "Failed to load YouTube channel details.",
          action: "Retry after running a fresh sync.",
        };
      }

      if (!channel) {
        return {
          ok: true,
          channelTitle: null,
          subscriberCount: 0,
          totalVideoCount: 0,
          lifetimeViews: 0,
          recentPeriod: {
            days: clampedDays,
            totalViews: 0,
            totalWatchMinutes: 0,
            netSubscribers: 0,
          },
          dailyData: [],
          message:
            "YouTube is connected but channel analytics are not synced yet.",
          action: "Run YouTube sync from the Integrations page.",
        };
      }

      const sinceDate = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { data: analytics, error: analyticsError } = await ctx.supabase
        .from("youtube_analytics")
        .select("*")
        .eq("user_id", ctx.userId)
        .gte("metric_date", sinceDate)
        .order("metric_date", { ascending: true });

      if (analyticsError) {
        return {
          ok: false,
          errorCode: "YOUTUBE_ANALYTICS_QUERY_FAILED",
          message: "Failed to load YouTube analytics.",
          action: "Retry after running a fresh YouTube sync.",
        };
      }

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
        ok: true,
        message:
          analytics && analytics.length > 0
            ? "YouTube channel stats loaded."
            : "No recent analytics rows were found for this period.",
        action:
          !analytics || analytics.length === 0
            ? "Run YouTube sync to populate daily analytics."
            : undefined,
        channelTitle: channel.title,
        subscriberCount: channel.subscriber_count,
        totalVideoCount: channel.video_count,
        lifetimeViews: channel.view_count,
        recentPeriod: {
          days: clampedDays,
          totalViews,
          totalWatchMinutes,
          netSubscribers,
        },
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
      const readiness = await ensureYouTubeDataReady(ctx);
      if (readiness.error) return readiness.error;

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

      const { data, error } = await query;

      if (error) {
        return {
          ok: false,
          errorCode: "YOUTUBE_VIDEOS_QUERY_FAILED",
          message: "Failed to load YouTube videos.",
          action: "Retry after running a fresh YouTube sync.",
        };
      }

      if (!data || data.length === 0) {
        return {
          ok: true,
          videos: [],
          message:
            "No videos found for this account or filter yet.",
          action: "Run YouTube sync to import video history.",
        };
      }

      return {
        ok: true,
        message: "Top YouTube videos loaded.",
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
      const readiness = await ensureYouTubeDataReady(ctx);
      if (readiness.error) return readiness.error;

      const { data, error } = await ctx.supabase
        .from("youtube_videos")
        .select("*")
        .eq("user_id", ctx.userId)
        .ilike("title", `%${videoTitle}%`)
        .limit(1)
        .maybeSingle();

      if (error) {
        return {
          ok: false,
          errorCode: "YOUTUBE_VIDEO_LOOKUP_FAILED",
          message: "Failed to look up video performance.",
          action: "Retry with a shorter video title.",
        };
      }

      if (!data) {
        return {
          ok: true,
          message: `Video matching "${videoTitle}" was not found in synced data.`,
          action: "Run YouTube sync, then try with a different title fragment.",
        };
      }

      // Also fetch top comments for this video
      const { data: comments, count: commentCount, error: commentsError } =
        await ctx.supabase
        .from("youtube_comments")
        .select("text_display, author_name, like_count, published_at", {
          count: "exact",
        })
        .eq("user_id", ctx.userId)
        .eq("video_id", data.video_id)
        .order("like_count", { ascending: false })
        .limit(5);

      if (commentsError) {
        return {
          ok: false,
          errorCode: "YOUTUBE_COMMENTS_QUERY_FAILED",
          message: "Failed to load comments for this video.",
          action: "Retry after YouTube comments finish syncing.",
        };
      }

      return {
        ok: true,
        message: "Video performance loaded.",
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
      const readiness = await ensureYouTubeDataReady(ctx);
      if (readiness.error) return readiness.error;

      let query = ctx.supabase
        .from("youtube_comments")
        .select(
          "comment_id, video_id, text_display, author_name, like_count, reply_count, published_at"
        )
        .eq("user_id", ctx.userId);

      if (videoTitle) {
        const { data: video, error: videoLookupError } = await ctx.supabase
          .from("youtube_videos")
          .select("video_id")
          .eq("user_id", ctx.userId)
          .ilike("title", `%${videoTitle}%`)
          .maybeSingle();

        if (videoLookupError) {
          return {
            ok: false,
            errorCode: "YOUTUBE_VIDEO_LOOKUP_FAILED",
            message: "Failed to filter comments by video title.",
            action: "Retry with a shorter title fragment.",
          };
        }

        if (video) {
          query = query.eq("video_id", video.video_id);
        } else {
          return {
            ok: true,
            comments: [],
            message: `No synced video matched "${videoTitle}".`,
            action: "Run YouTube sync and retry.",
          };
        }
      }

      if (sortBy === "popular") {
        query = query.order("like_count", { ascending: false });
      } else {
        query = query.order("published_at", { ascending: false });
      }

      query = query.limit(limit);
      const { data, error } = await query;

      if (error) {
        return {
          ok: false,
          errorCode: "YOUTUBE_COMMENTS_QUERY_FAILED",
          message: "Failed to load YouTube comments.",
          action: "Retry after a fresh sync.",
        };
      }

      if (!data || data.length === 0) {
        return {
          ok: true,
          comments: [],
          message: "No comments found for this filter.",
          action: "Sync YouTube comments, then retry.",
        };
      }

      // Enrich with video titles
      const videoIds = [...new Set(data.map((c) => c.video_id))];
      const { data: videos, error: videosError } = await ctx.supabase
        .from("youtube_videos")
        .select("video_id, title")
        .eq("user_id", ctx.userId)
        .in("video_id", videoIds);

      if (videosError) {
        return {
          ok: false,
          errorCode: "YOUTUBE_VIDEO_TITLE_MAP_FAILED",
          message: "Failed to map comments to video titles.",
          action: "Retry after video sync completes.",
        };
      }

      const videoTitleMap = new Map(
        (videos || []).map((v) => [v.video_id, v.title])
      );

      return {
        ok: true,
        message: "Recent YouTube comments loaded.",
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
