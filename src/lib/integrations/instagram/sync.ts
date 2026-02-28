import type { Firestore } from "firebase-admin/firestore";
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
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function syncAccount(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
): Promise<void> {
  const account = await getInstagramAccount(config, igUserId);

  const accountRef = db.collection(COLLECTIONS.INSTAGRAM_ACCOUNTS).doc();
  await accountRef.set({
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
  }, { merge: true });
}

export async function syncPosts(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
): Promise<{ synced: number }> {
  let cursor: string | undefined;
  let totalSynced = 0;
  const maxPosts = 100;
  const batch = db.batch();
  let batchCount = 0;

  do {
    const { media, nextCursor } = await getMedia(config, igUserId, cursor);

    for (const item of media) {
      // Fetch insights per post (may fail for some types)
      const insights = await getMediaInsights(config, item.id);

      const postRef = db.collection(COLLECTIONS.INSTAGRAM_POSTS).doc();
      batch.set(postRef, {
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
      }, { merge: true });

      batchCount++;
      totalSynced++;

      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }

    cursor = nextCursor;
  } while (cursor && totalSynced < maxPosts);

  if (batchCount > 0) {
    await batch.commit();
  }

  return { synced: totalSynced };
}

export async function syncPostComments(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: InstagramConfig
): Promise<{ synced: number }> {
  // Get 25 most recent posts
  const postsSnapshot = await db
    .collection(COLLECTIONS.INSTAGRAM_POSTS)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .orderBy("published_at", "desc")
    .limit(25)
    .get();

  if (postsSnapshot.empty) return { synced: 0 };

  let totalSynced = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const postDoc of postsSnapshot.docs) {
    const post = postDoc.data();
    try {
      // First page of comments per post
      const { comments } = await getComments(config, post.post_id);

      for (const comment of comments) {
        const commentRef = db.collection(COLLECTIONS.INSTAGRAM_COMMENTS).doc();
        batch.set(commentRef, {
          user_id: userId,
          integration_id: integrationId,
          post_id: post.post_id,
          comment_id: comment.id,
          text: comment.text,
          username: comment.username || null,
          published_at: comment.timestamp,
          like_count: comment.like_count || 0,
          synced_at: new Date().toISOString(),
        }, { merge: true });

        batchCount++;
        totalSynced++;

        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
    } catch {
      console.warn(`Failed to sync comments for IG post ${post.post_id}`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return { synced: totalSynced };
}

export async function syncAccountAnalytics(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
): Promise<{ synced: number }> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - 90 * 24 * 60 * 60; // 90 days back

  const insights = await getAccountInsights(config, igUserId, since, now);

  let synced = 0;
  const batch = db.batch();

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
    const analyticsRef = db.collection(COLLECTIONS.INSTAGRAM_ANALYTICS).doc();
    batch.set(analyticsRef, {
      user_id: userId,
      integration_id: integrationId,
      metric_date: date,
      follower_count: metrics.follower_count ?? null,
      impressions: metrics.impressions ?? null,
      reach: metrics.reach ?? null,
      profile_views: metrics.profile_views ?? null,
      synced_at: new Date().toISOString(),
    }, { merge: true });
    synced++;
  }

  if (synced > 0) {
    await batch.commit();
  }

  return { synced };
}

export async function runFullSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: InstagramConfig,
  igUserId: string
) {
  // 1. Sync account info
  await syncAccount(db, userId, integrationId, config, igUserId);

  // 2. Sync posts
  const posts = await syncPosts(db, userId, integrationId, config, igUserId);

  // 3. Sync comments on recent posts
  const comments = await syncPostComments(db, userId, integrationId, config);

  // 4. Sync account-level daily analytics
  const analytics = await syncAccountAnalytics(
    db,
    userId,
    integrationId,
    config,
    igUserId
  );

  // 5. Persist any refreshed token
  await persistRefreshedToken(
    db,
    integrationId,
    config.accessToken,
    config.tokenExpiresAt
  );

  // 6. Update last_synced_at
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({ last_synced_at: new Date().toISOString() });

  // 7. Generate insights
  let insightsGenerated = 0;
  try {
    const insightResult = await generateInstagramInsights(
      db,
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
