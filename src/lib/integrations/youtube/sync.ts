import { SupabaseClient } from "@supabase/supabase-js";
import {
  getChannelInfo,
  getChannelVideos,
  getVideoComments,
  getChannelAnalytics,
  persistRefreshedTokens,
  YouTubeConfig,
} from "./client";
import { generateYouTubeInsights } from "@/lib/insights/generate";

export async function syncChannel(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: YouTubeConfig
): Promise<{ channelId: string }> {
  const channel = await getChannelInfo(config);

  await supabase.from("youtube_channels").upsert(
    {
      user_id: userId,
      integration_id: integrationId,
      channel_id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      custom_url: channel.snippet.customUrl || null,
      thumbnail_url: channel.snippet.thumbnails?.default?.url || null,
      country: channel.snippet.country || null,
      published_at: channel.snippet.publishedAt,
      subscriber_count: parseInt(channel.statistics.subscriberCount) || 0,
      video_count: parseInt(channel.statistics.videoCount) || 0,
      view_count: parseInt(channel.statistics.viewCount) || 0,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel_id" }
  );

  return { channelId: channel.id };
}

export async function syncVideos(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: YouTubeConfig,
  channelId: string
): Promise<{ synced: number }> {
  let pageToken: string | undefined;
  let totalSynced = 0;

  do {
    const { videos, nextPageToken } = await getChannelVideos(
      config,
      channelId,
      pageToken
    );

    for (const video of videos) {
      await supabase.from("youtube_videos").upsert(
        {
          user_id: userId,
          integration_id: integrationId,
          channel_id: channelId,
          video_id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail_url: video.snippet.thumbnails?.medium?.url || null,
          published_at: video.snippet.publishedAt,
          duration: video.contentDetails.duration,
          tags: video.snippet.tags || [],
          category_id: video.snippet.categoryId || null,
          privacy_status: video.status.privacyStatus,
          view_count: parseInt(video.statistics.viewCount) || 0,
          like_count: parseInt(video.statistics.likeCount) || 0,
          comment_count: parseInt(video.statistics.commentCount) || 0,
          favorite_count: parseInt(video.statistics.favoriteCount) || 0,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,video_id" }
      );
      totalSynced++;
    }

    pageToken = nextPageToken;
  } while (pageToken);

  return { synced: totalSynced };
}

export async function syncComments(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: YouTubeConfig
): Promise<{ synced: number }> {
  // Get recent videos to fetch comments for
  const { data: videos } = await supabase
    .from("youtube_videos")
    .select("video_id")
    .eq("user_id", userId)
    .eq("integration_id", integrationId)
    .order("published_at", { ascending: false })
    .limit(50);

  if (!videos || videos.length === 0) return { synced: 0 };

  let totalSynced = 0;

  for (const video of videos) {
    try {
      let pageToken: string | undefined;
      // Limit to first page of comments per video to manage API quota
      const { comments } = await getVideoComments(
        config,
        video.video_id,
        pageToken
      );

      for (const thread of comments) {
        const snippet = thread.snippet.topLevelComment.snippet;
        await supabase.from("youtube_comments").upsert(
          {
            user_id: userId,
            integration_id: integrationId,
            video_id: video.video_id,
            comment_id: thread.snippet.topLevelComment.id,
            parent_comment_id: null,
            author_name: snippet.authorDisplayName,
            author_channel_id: snippet.authorChannelId?.value || null,
            author_image_url: snippet.authorProfileImageUrl || null,
            text_display: snippet.textDisplay,
            like_count: snippet.likeCount || 0,
            reply_count: thread.snippet.totalReplyCount || 0,
            published_at: snippet.publishedAt,
            updated_at_yt: snippet.updatedAt,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,comment_id" }
        );
        totalSynced++;
      }
    } catch {
      // Comments may be disabled on some videos -- skip and continue
      console.warn(`Failed to sync comments for video ${video.video_id}`);
    }
  }

  return { synced: totalSynced };
}

export async function syncAnalytics(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: YouTubeConfig,
  channelId: string,
  sinceDate?: string
): Promise<{ synced: number }> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate =
    sinceDate ||
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const analytics = await getChannelAnalytics(config, startDate, endDate);
  let synced = 0;

  for (const row of analytics.rows || []) {
    // Row order matches dimensions=day + metrics order:
    // [day, views, estimatedMinutesWatched, subscribersGained, subscribersLost,
    //  likes, dislikes, comments, shares, averageViewDuration]
    await supabase.from("youtube_analytics").upsert(
      {
        user_id: userId,
        integration_id: integrationId,
        channel_id: channelId,
        metric_date: row[0],
        views: row[1] || 0,
        estimated_minutes_watched: row[2] || 0,
        subscribers_gained: row[3] || 0,
        subscribers_lost: row[4] || 0,
        likes: row[5] || 0,
        dislikes: row[6] || 0,
        comments: row[7] || 0,
        shares: row[8] || 0,
        average_view_duration: row[9] || 0,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,channel_id,metric_date" }
    );
    synced++;
  }

  return { synced };
}

export async function runFullSync(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: YouTubeConfig
) {
  // 1. Sync channel info
  const { channelId } = await syncChannel(
    supabase,
    userId,
    integrationId,
    config
  );

  // 2. Sync videos
  const videos = await syncVideos(
    supabase,
    userId,
    integrationId,
    config,
    channelId
  );

  // 3. Sync comments for recent videos
  const comments = await syncComments(supabase, userId, integrationId, config);

  // 4. Sync analytics time-series
  const analytics = await syncAnalytics(
    supabase,
    userId,
    integrationId,
    config,
    channelId
  );

  // 5. Persist any refreshed tokens
  await persistRefreshedTokens(
    supabase,
    integrationId,
    config.accessToken,
    config.tokenExpiresAt
  );

  // 6. Update last_synced_at
  await supabase
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", integrationId);

  let insightsGenerated = 0;
  try {
    const insightResult = await generateYouTubeInsights(
      supabase,
      userId,
      integrationId
    );
    insightsGenerated = insightResult.created;
  } catch (error) {
    console.error("YouTube insight generation failed:", error);
  }

  return {
    channelId,
    videos: videos.synced,
    comments: comments.synced,
    analytics: analytics.synced,
    insights: insightsGenerated,
  };
}
