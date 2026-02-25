import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function getTikTokAccountStats(ctx: ToolContext) {
  return tool({
    description:
      "Get TikTok account overview: display name, followers, following, total likes, and video count",
    inputSchema: z.object({}),
    execute: async () => {
      const { data: account } = await ctx.supabase
        .from("tiktok_accounts")
        .select("*")
        .eq("user_id", ctx.userId)
        .limit(1)
        .single();

      if (!account) {
        return {
          message:
            "No TikTok account found. Connect your TikTok account first.",
        };
      }

      return {
        displayName: account.display_name,
        followerCount: account.follower_count,
        followingCount: account.following_count,
        totalLikes: account.likes_count,
        videoCount: account.video_count,
        bioDescription: account.bio_description,
      };
    },
  });
}

export function getTopTikTokVideos(ctx: ToolContext) {
  return tool({
    description:
      "Get top-performing TikTok videos sorted by views, likes, comments, or shares",
    inputSchema: z.object({
      sortBy: z
        .enum(["views", "likes", "comments", "shares"])
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
        shares: "share_count",
      } as const;

      let query = ctx.supabase
        .from("tiktok_videos")
        .select(
          "video_id, title, description, create_time, cover_image_url, share_url, duration, view_count, like_count, comment_count, share_count"
        )
        .eq("user_id", ctx.userId)
        .order(columnMap[sortBy], { ascending: false })
        .limit(limit);

      if (publishedAfter) {
        query = query.gte("create_time", publishedAfter);
      }

      const { data } = await query;

      if (!data || data.length === 0) {
        return {
          videos: [],
          message:
            "No videos found. Connect TikTok and sync to see video data.",
        };
      }

      return {
        videos: data.map((v) => ({
          videoId: v.video_id,
          title: v.title,
          description: v.description?.substring(0, 150),
          createdAt: v.create_time,
          coverImageUrl: v.cover_image_url,
          shareUrl: v.share_url,
          duration: v.duration,
          views: Number(v.view_count),
          likes: Number(v.like_count),
          comments: Number(v.comment_count),
          shares: Number(v.share_count),
          engagementRate:
            Number(v.view_count) > 0
              ? ((Number(v.like_count) +
                  Number(v.comment_count) +
                  Number(v.share_count)) /
                  Number(v.view_count)) *
                100
              : 0,
        })),
      };
    },
  });
}

export function getTikTokVideoPerformance(ctx: ToolContext) {
  return tool({
    description:
      "Get detailed performance data for a specific TikTok video by title search",
    inputSchema: z.object({
      videoTitle: z
        .string()
        .describe("Video title or partial match to search for"),
    }),
    execute: async ({ videoTitle }) => {
      const { data } = await ctx.supabase
        .from("tiktok_videos")
        .select("*")
        .eq("user_id", ctx.userId)
        .ilike("title", `%${videoTitle}%`)
        .limit(1)
        .single();

      if (!data) {
        return { message: `Video matching "${videoTitle}" not found.` };
      }

      return {
        videoId: data.video_id,
        title: data.title,
        description: data.description,
        createdAt: data.create_time,
        coverImageUrl: data.cover_image_url,
        shareUrl: data.share_url,
        duration: data.duration,
        views: Number(data.view_count),
        likes: Number(data.like_count),
        comments: Number(data.comment_count),
        shares: Number(data.share_count),
        engagementRate:
          Number(data.view_count) > 0
            ? ((Number(data.like_count) +
                Number(data.comment_count) +
                Number(data.share_count)) /
                Number(data.view_count)) *
              100
            : 0,
      };
    },
  });
}
