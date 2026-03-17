import type { Firestore } from "firebase-admin/firestore";
import {
  getPagePosts,
  getPostInsights,
  getComments,
  getPageInsights,
  persistRefreshedToken,
  type FacebookConfig,
  type FBPageData,
} from "./client";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function syncPage(
  db: Firestore,
  userId: string,
  integrationId: string,
  page: FBPageData
): Promise<void> {
  const pageRef = db.collection(COLLECTIONS.FACEBOOK_PAGES).doc();
  await pageRef.set({
    user_id: userId,
    integration_id: integrationId,
    page_id: page.id,
    name: page.name,
    category: page.category || null,
    about: page.about || null,
    description: page.description || null,
    link: page.link || null,
    picture_url: page.picture?.data?.url || null,
    fan_count: page.fan_count || 0,
    followers_count: page.followers_count || 0,
    synced_at: new Date().toISOString(),
  }, { merge: true });
}

export async function syncPosts(
  db: Firestore,
  userId: string,
  integrationId: string,
  pageConfig: FacebookConfig,
  pageId: string
): Promise<{ synced: number }> {
  let cursor: string | undefined;
  let totalSynced = 0;
  const maxPosts = 100;
  const batch = db.batch();
  let batchCount = 0;

  do {
    const { posts, nextCursor } = await getPagePosts(pageConfig, pageId, cursor);

    for (const item of posts) {
      const insights = await getPostInsights(pageConfig, item.id);

      const postRef = db.collection(COLLECTIONS.FACEBOOK_POSTS).doc();
      batch.set(postRef, {
        user_id: userId,
        integration_id: integrationId,
        page_id: pageId,
        post_id: item.id,
        message: item.message || null,
        created_time: item.created_time,
        permalink_url: item.permalink_url || null,
        full_picture: item.full_picture || null,
        shares_count: item.shares?.count || 0,
        impressions: insights.impressions ?? null,
        reach: insights.reach ?? null,
        engagement: insights.engagement ?? null,
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
  pageConfig: FacebookConfig
): Promise<{ synced: number }> {
  const postsSnapshot = await db
    .collection(COLLECTIONS.FACEBOOK_POSTS)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .orderBy("created_time", "desc")
    .limit(25)
    .get();

  if (postsSnapshot.empty) return { synced: 0 };

  let totalSynced = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const postDoc of postsSnapshot.docs) {
    const post = postDoc.data();
    try {
      const { comments } = await getComments(pageConfig, post.post_id);

      for (const comment of comments) {
        const commentRef = db.collection(COLLECTIONS.FACEBOOK_COMMENTS).doc();
        batch.set(commentRef, {
          user_id: userId,
          integration_id: integrationId,
          page_id: post.page_id,
          post_id: post.post_id,
          comment_id: comment.id,
          text: comment.message,
          author_name: comment.from?.name || null,
          author_id: comment.from?.id || null,
          created_time: comment.created_time,
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
      console.warn(`Failed to sync comments for FB post ${post.post_id}`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return { synced: totalSynced };
}

export async function syncPageAnalytics(
  db: Firestore,
  userId: string,
  integrationId: string,
  pageConfig: FacebookConfig,
  pageId: string
): Promise<{ synced: number }> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - 90 * 24 * 60 * 60;

  const insights = await getPageInsights(pageConfig, pageId, since, now);

  let synced = 0;
  const batch = db.batch();
  const dateMap: Record<string, Record<string, number>> = {};

  for (const metric of insights) {
    for (const value of metric.values || []) {
      const date = value.end_time.split("T")[0];
      if (!dateMap[date]) dateMap[date] = {};
      dateMap[date][metric.name] = value.value;
    }
  }

  for (const [date, metrics] of Object.entries(dateMap)) {
    const analyticsRef = db.collection(COLLECTIONS.FACEBOOK_ANALYTICS).doc();
    batch.set(analyticsRef, {
      user_id: userId,
      integration_id: integrationId,
      page_id: pageId,
      metric_date: date,
      impressions: metrics.page_impressions ?? null,
      engaged_users: metrics.page_engaged_users ?? null,
      actions: metrics.page_total_actions ?? null,
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
  config: FacebookConfig,
  pages: FBPageData[]
) {
  let totalPosts = 0;
  let totalComments = 0;
  let totalAnalytics = 0;

  for (const page of pages) {
    const pageConfig: FacebookConfig = {
      accessToken: page.access_token,
      tokenExpiresAt: config.tokenExpiresAt,
    };

    await syncPage(db, userId, integrationId, page);
    
    const posts = await syncPosts(db, userId, integrationId, pageConfig, page.id);
    totalPosts += posts.synced;

    const comments = await syncPostComments(db, userId, integrationId, pageConfig);
    totalComments += comments.synced;

    const analytics = await syncPageAnalytics(db, userId, integrationId, pageConfig, page.id);
    totalAnalytics += analytics.synced;
  }

  await persistRefreshedToken(
    db,
    integrationId,
    config.accessToken,
    config.tokenExpiresAt
  );

  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({ last_synced_at: new Date().toISOString() });

  return {
    posts: totalPosts,
    comments: totalComments,
    analytics: totalAnalytics,
  };
}
