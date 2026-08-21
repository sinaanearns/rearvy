import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import {
  findYouTubeChannelForUser,
  getYouTubeAnalyticsForUser,
  getYouTubeCommentsForUser,
  getYouTubeVideosForUser,
  type YouTubeVideoRecord,
} from "@/lib/integrations/youtube/queries";

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
      const channel = await findYouTubeChannelForUser(ctx.adminDb, ctx.userId);

      if (!channel) {
        return {
          message:
            "No YouTube channel found. Connect your YouTube account first.",
        };
      }

      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const analytics = await getYouTubeAnalyticsForUser(ctx.adminDb, ctx.userId, {
        channelId: channel.channel_id,
        sinceDate,
        sortDirection: "asc",
      });

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

      const data = await getYouTubeVideosForUser(ctx.adminDb, ctx.userId, {
        publishedAfter,
        sortBy: columnMap[sortBy],
        sortDirection: "desc",
        limit,
      });

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
      const allVideos = await getYouTubeVideosForUser(ctx.adminDb, ctx.userId);
      const data = allVideos.find((v) =>
        v.title?.toLowerCase().includes(videoTitle.toLowerCase())
      );

      if (!data) {
        return { message: `Video matching "${videoTitle}" not found.` };
      }

      const allComments = await getYouTubeCommentsForUser(ctx.adminDb, ctx.userId, {
        videoId: data.video_id,
      });
      const topComments = [...allComments]
        .sort((left, right) => Number(right.like_count) - Number(left.like_count))
        .slice(0, 5);
      const commentCount = allComments.length;

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
        topComments: topComments.map((c) => ({
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
      let userVideos: YouTubeVideoRecord[] = [];

      if (videoTitle) {
        userVideos = await getYouTubeVideosForUser(ctx.adminDb, ctx.userId);
        const matchedVideo = userVideos.find((v) =>
          v.title?.toLowerCase().includes(videoTitle.toLowerCase())
        );
        if (matchedVideo) {
          videoId = matchedVideo.video_id;
        }
      }

      const data = await getYouTubeCommentsForUser(ctx.adminDb, ctx.userId, {
        videoId,
        sortBy: sortBy === "popular" ? "like_count" : "published_at",
        sortDirection: "desc",
        limit,
      });

      if (!data || data.length === 0) {
        return { comments: [], message: "No comments found." };
      }

      // Enrich with video titles
      const videos =
        userVideos.length > 0
          ? userVideos
          : await getYouTubeVideosForUser(ctx.adminDb, ctx.userId);

      const videoTitleMap = new Map(
        videos.map((v) => [v.video_id, v.title])
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

export function recreateYouTubeVideoFrameByFrame(ctx: ToolContext) {
  function normalizeProjectName(value: string) {
    return value.trim().replace(/[^\w.-]+/g, "_").slice(0, 80) || "Rearvy_YouTube_Recreation";
  }

  return tool({
    description:
      "Creates an AI-guided content recreation plan from a YouTube/reference URL or supplied frames. Uses NVIDIA routing for visual breakdown, prepares original asset prompts, and exports DaVinci Resolve FCPXML/EDL timeline content.",
    inputSchema: z.object({
      youtubeUrl: z
        .string()
        .describe("YouTube or reference video URL used for visual inspiration and planning."),
      projectName: z
        .string()
        .optional()
        .default("Rearvy_YouTube_Recreation")
        .describe("Target folder project name on Desktop"),
      topic: z
        .string()
        .optional()
        .describe("Topic or product angle for the recreated content."),
      targetNiche: z
        .string()
        .optional()
        .default("SaaS / Technology")
        .describe("Market/niche for the recreated content."),
      sourceUseMode: z
        .enum(["reference_only", "owned_or_licensed_assets"])
        .optional()
        .default("reference_only")
        .describe("Use reference_only for inspiration; owned_or_licensed_assets only when the user owns or has licensed the source assets."),
      referenceFrames: z
        .array(z.string())
        .max(8)
        .optional()
        .describe("Optional base64/data URL reference frames extracted by the desktop app."),
      targetEditor: z
        .enum(["davinci", "premiere", "fcpxml"])
        .optional()
        .default("davinci")
        .describe("Video editor target timeline format"),
    }),
    execute: async ({
      youtubeUrl,
      projectName,
      topic,
      targetNiche,
      sourceUseMode,
      referenceFrames,
      targetEditor,
    }) => {
      try {
        const { resolveSaveFromDownloadUrl } = await import("@/lib/ai/youtube-downloader");
        const { buildDaVinciFcpxml, buildDaVinciEdl } = await import("@/lib/ai/davinci-timeline-builder");
        const { createContentRecreationPlan } = await import("@/lib/ai/content-recreation-workflow");
        const safeProjectName = normalizeProjectName(projectName);

        const downloadInfo = await resolveSaveFromDownloadUrl({
          youtubeUrl,
          sourceUseMode,
        });
        if (!downloadInfo.success) {
          return {
            success: false,
            error: downloadInfo.error || "Failed to resolve YouTube video link.",
          };
        }

        let planResult: Awaited<ReturnType<typeof createContentRecreationPlan>>;
        try {
          planResult = await createContentRecreationPlan({
            topic: topic || downloadInfo.title || projectName,
            targetNiche,
            referenceUrl: youtubeUrl,
            sourceUseMode,
            frames: referenceFrames,
          });
        } catch (planError) {
          const message =
            planError instanceof Error ? planError.message : String(planError);
          return {
            success: false,
            error: `AI content recreation plan failed: ${message.slice(0, 400)}. Try again or supply reference frames for better results.`,
            youtubeUrl,
            hint: "The AI model may have returned an invalid response. Retry or simplify your topic.",
          };
        }

        const fps = planResult.plan.davinciResolvePlan.fps || 30;
        let startFrame = 0;
        const timelineClips = planResult.plan.shots.map((shot) => {
          const durationFrames = Math.max(30, Math.round(shot.durationSeconds * fps));
          const clip = {
            sceneIndex: shot.sceneIndex,
            fileName: `frame_${String(shot.sceneIndex).padStart(3, "0")}.png`,
            filePath: `C:/Users/Public/Desktop/${safeProjectName}/assets/frame_${String(shot.sceneIndex).padStart(3, "0")}.png`,
            durationSeconds: shot.durationSeconds,
            startFrame,
            endFrame: startFrame + durationFrames,
            onScreenText: shot.onScreenText,
            prompt: shot.suggestedPrompt,
          };
          startFrame += durationFrames;
          return clip;
        });

        const fcpxml = buildDaVinciFcpxml({
          title: safeProjectName,
          fps,
          clips: timelineClips,
        });

        const edl = buildDaVinciEdl({
          title: safeProjectName,
          fps,
          clips: timelineClips,
        });

        const projectRoot = `C:/Users/Public/Desktop/${safeProjectName}`;
        const fcpxmlPath = `${projectRoot}/${safeProjectName}.fcpxml`;
        const edlPath = `${projectRoot}/${safeProjectName}.edl`;

        return {
          success: true,
          youtubeUrl,
          referenceInfo: downloadInfo,
          targetEditor,
          projectName: safeProjectName,
          shotsCount: planResult.plan.shots.length,
          plan: planResult.plan,
          modelRoute: planResult.modelRoute,
          shots: timelineClips,
          timelineFiles: {
            fcpxmlFileName: `${safeProjectName}.fcpxml`,
            edlFileName: `${safeProjectName}.edl`,
            fcpxmlPath,
            edlPath,
            fcpxmlContent: fcpxml,
            edlContent: edl,
          },
          desktopWorkflow: {
            id: `davinci_recreation_${Date.now()}`,
            name: `Prepare ${safeProjectName} in DaVinci Resolve`,
            description:
              "Create project timeline artifacts, reveal the asset folder, and launch DaVinci Resolve for the approved plan.",
            requiresApproval: true,
            steps: [
              {
                id: "step_create_project_folder",
                name: "Create project folder",
                action: {
                  type: "createDirectory",
                  path: `${projectRoot}/assets`,
                  revealAfterCreate: true,
                },
                timeout: 10_000,
              },
              {
                id: "step_write_fcpxml",
                name: "Write DaVinci FCPXML",
                action: {
                  type: "writeFile",
                  path: fcpxmlPath,
                  content: fcpxml,
                  revealAfterWrite: true,
                },
                timeout: 10_000,
              },
              {
                id: "step_write_edl",
                name: "Write EDL backup",
                action: {
                  type: "writeFile",
                  path: edlPath,
                  content: edl,
                },
                timeout: 10_000,
              },
              {
                id: "step_launch_resolve",
                name: "Launch DaVinci Resolve",
                action: {
                  type: "launchApp",
                  appPath: "Resolve.exe",
                  fallbackUrl: "https://www.blackmagicdesign.com/products/davinciresolve",
                  wait: true,
                },
                timeout: 20_000,
              },
            ],
          },
          instructions: planResult.plan.davinciResolvePlan.editSteps,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: `Recreation tool encountered an unexpected error: ${message.slice(0, 400)}`,
          youtubeUrl,
        };
      }
    },
  });
}
