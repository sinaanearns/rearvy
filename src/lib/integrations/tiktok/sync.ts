import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getUserInfo,
  getVideos,
  persistRefreshedTokens,
  type TikTokConfig,
} from "./client";
import { generateTikTokInsights } from "@/lib/insights/generate";

export async function syncAccount(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: TikTokConfig
): Promise<{ tiktokId: string }> {
  const user = await getUserInfo(config);

  await supabase.from("tiktok_accounts").upsert(
    {
      user_id: userId,
      integration_id: integrationId,
      tiktok_id: user.open_id,
      display_name: user.display_name || null,
      avatar_url: user.avatar_url || null,
      bio_description: user.bio_description || null,
      follower_count: user.follower_count || 0,
      following_count: user.following_count || 0,
      likes_count: user.likes_count || 0,
      video_count: user.video_count || 0,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tiktok_id" }
  );

  return { tiktokId: user.open_id };
}

export async function syncVideos(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: TikTokConfig
): Promise<{ synced: number }> {
  let cursor: number | undefined;
  let totalSynced = 0;
  const maxVideos = 200;

  do {
    const { videos, cursor: nextCursor, hasMore } = await getVideos(
      config,
      cursor,
      20
    );

    for (const video of videos) {
      await supabase.from("tiktok_videos").upsert(
        {
          user_id: userId,
          integration_id: integrationId,
          video_id: video.id,
          title: video.title || null,
          description: video.description || null,
          create_time: video.create_time
            ? new Date(video.create_time * 1000).toISOString()
            : null,
          cover_image_url: video.cover_image_url || null,
          share_url: video.share_url || null,
          duration: video.duration || 0,
          view_count: video.view_count || 0,
          like_count: video.like_count || 0,
          comment_count: video.comment_count || 0,
          share_count: video.share_count || 0,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,video_id" }
      );
      totalSynced++;
    }

    cursor = hasMore ? nextCursor : undefined;
  } while (cursor && totalSynced < maxVideos);

  return { synced: totalSynced };
}

export async function runFullSync(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: TikTokConfig
) {
  // 1. Sync account info
  const { tiktokId } = await syncAccount(
    supabase,
    userId,
    integrationId,
    config
  );

  // 2. Sync videos
  const videos = await syncVideos(supabase, userId, integrationId, config);

  // 3. Persist any refreshed tokens
  await persistRefreshedTokens(
    supabase,
    integrationId,
    config.accessToken,
    config.refreshToken,
    config.tokenExpiresAt
  );

  // 4. Update last_synced_at
  await supabase
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", integrationId);

  // 5. Generate insights
  let insightsGenerated = 0;
  try {
    const insightResult = await generateTikTokInsights(
      supabase,
      userId,
      integrationId
    );
    insightsGenerated = insightResult.created;
  } catch (error) {
    console.error("TikTok insight generation failed:", error);
  }

  return {
    tiktokId,
    videos: videos.synced,
    insights: insightsGenerated,
  };
}
