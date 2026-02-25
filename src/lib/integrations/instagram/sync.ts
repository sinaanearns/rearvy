import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getInstagramAccount,
  getMedia,
  getMediaInsights,
  getComments,
  getAccountInsights,
  persistRefreshedToken,
  type InstagramConfig,
} from "./client";
import { generateInstagramInsights } from "@/lib/insights/generate";

export async function syncAccount(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
): Promise<void> {
  const account = await getInstagramAccount(config, igUserId);

  await supabase.from("instagram_accounts").upsert(
    {
      user_id: userId,
      integration_id: integrationId,
      instagram_id: account.id,
      username: account.username,
      name: account.name || null,
      profile_picture_url: account.profile_picture_url || null,
      biography: account.biography || null,
      website: account.website || null,
      followers_count: account.followers_count || 0,
      follows_count: account.follows_count || 0,
      media_count: account.media_count || 0,
      synced_at: new Date().toISOString(),
    },
    { onConflict: "user_id,instagram_id" }
  );
}

export async function syncPosts(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
): Promise<{ synced: number }> {
  let cursor: string | undefined;
  let totalSynced = 0;
  const maxPosts = 100;

  do {
    const { media, nextCursor } = await getMedia(config, igUserId, cursor);

    for (const item of media) {
      // Fetch insights per post (may fail for some types)
      const insights = await getMediaInsights(config, item.id);

      await supabase.from("instagram_posts").upsert(
        {
          user_id: userId,
          integration_id: integrationId,
          post_id: item.id,
          caption: item.caption || null,
          media_type: item.media_type,
          media_url: item.media_url || null,
          thumbnail_url: item.thumbnail_url || null,
          permalink: item.permalink || null,
          published_at: item.timestamp,
          like_count: item.like_count || 0,
          comments_count: item.comments_count || 0,
          reach: insights.reach ?? null,
          impressions: insights.impressions ?? null,
          engagement: insights.engagement ?? null,
          saved: insights.saved ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,post_id" }
      );
      totalSynced++;
    }

    cursor = nextCursor;
  } while (cursor && totalSynced < maxPosts);

  return { synced: totalSynced };
}

export async function syncPostComments(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: InstagramConfig
): Promise<{ synced: number }> {
  // Get 25 most recent posts
  const { data: posts } = await supabase
    .from("instagram_posts")
    .select("post_id")
    .eq("user_id", userId)
    .eq("integration_id", integrationId)
    .order("published_at", { ascending: false })
    .limit(25);

  if (!posts || posts.length === 0) return { synced: 0 };

  let totalSynced = 0;

  for (const post of posts) {
    try {
      // First page of comments per post
      const { comments } = await getComments(config, post.post_id);

      for (const comment of comments) {
        await supabase.from("instagram_comments").upsert(
          {
            user_id: userId,
            integration_id: integrationId,
            post_id: post.post_id,
            comment_id: comment.id,
            text: comment.text,
            username: comment.username || null,
            published_at: comment.timestamp,
            like_count: comment.like_count || 0,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,comment_id" }
        );
        totalSynced++;
      }
    } catch {
      console.warn(`Failed to sync comments for IG post ${post.post_id}`);
    }
  }

  return { synced: totalSynced };
}

export async function syncAccountAnalytics(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
): Promise<{ synced: number }> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - 90 * 24 * 60 * 60; // 90 days back

  const insights = await getAccountInsights(config, igUserId, since, now);

  let synced = 0;

  // Organize insights by date
  const dateMap: Record<string, Record<string, number>> = {};

  for (const metric of insights) {
    for (const value of metric.values || []) {
      const date = value.end_time.split("T")[0];
      if (!dateMap[date]) dateMap[date] = {};
      dateMap[date][metric.name] = value.value;
    }
  }

  for (const [date, metrics] of Object.entries(dateMap)) {
    await supabase.from("instagram_analytics").upsert(
      {
        user_id: userId,
        integration_id: integrationId,
        metric_date: date,
        follower_count: metrics.follower_count ?? null,
        impressions: metrics.impressions ?? null,
        reach: metrics.reach ?? null,
        profile_views: metrics.profile_views ?? null,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,integration_id,metric_date" }
    );
    synced++;
  }

  return { synced };
}

export async function runFullSync(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
) {
  // 1. Sync account info
  await syncAccount(supabase, userId, integrationId, config, igUserId);

  // 2. Sync posts
  const posts = await syncPosts(supabase, userId, integrationId, config, igUserId);

  // 3. Sync comments on recent posts
  const comments = await syncPostComments(supabase, userId, integrationId, config);

  // 4. Sync account-level daily analytics
  const analytics = await syncAccountAnalytics(
    supabase,
    userId,
    integrationId,
    config,
    igUserId
  );

  // 5. Persist any refreshed token
  await persistRefreshedToken(
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

  // 7. Generate insights
  let insightsGenerated = 0;
  try {
    const insightResult = await generateInstagramInsights(
      supabase,
      userId,
      integrationId
    );
    insightsGenerated = insightResult.created;
  } catch (error) {
    console.error("Instagram insight generation failed:", error);
  }

  return {
    posts: posts.synced,
    comments: comments.synced,
    analytics: analytics.synced,
    insights: insightsGenerated,
  };
}
