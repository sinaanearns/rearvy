import { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  getChannelInfo,
  getChannelVideos,
  getVideoComments,
  getChannelAnalytics,
  persistRefreshedTokens,
  YouTubeConfig,
} from "./client";
import { getYouTubeVideosForUser } from "./queries";
import { generateYouTubeInsights } from "@/lib/insights/generate";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("YouTubeSync");

export async function syncChannel(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: YouTubeConfig
): Promise<{ channelId: string }> {
  const channel = await getChannelInfo(config);

  const channelData = {
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
  };

  // Find existing channel or create new
  const existingSnapshot = await db
    .collection(COLLECTIONS.YOUTUBE_CHANNELS)
    .where("user_id", "==", userId)
    .where("channel_id", "==", channel.id)
    .get();

  if (!existingSnapshot.empty) {
    await existingSnapshot.docs[0].ref.set(channelData, { merge: true });
  } else {
    await db.collection(COLLECTIONS.YOUTUBE_CHANNELS).add(channelData);
  }

  return { channelId: channel.id };
}

export async function syncVideos(
  db: Firestore,
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

    const batch = db.batch();
    for (const video of videos) {
      const videoData = {
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
      };

      // Find existing video or create new
      const existingSnapshot = await db
        .collection(COLLECTIONS.YOUTUBE_VIDEOS)
        .where("user_id", "==", userId)
        .where("video_id", "==", video.id)
        .get();

      if (!existingSnapshot.empty) {
        batch.set(existingSnapshot.docs[0].ref, videoData, { merge: true });
      } else {
        const newDocRef = db.collection(COLLECTIONS.YOUTUBE_VIDEOS).doc();
        batch.set(newDocRef, videoData);
      }
      totalSynced++;
    }
    await batch.commit();

    pageToken = nextPageToken;
  } while (pageToken);

  return { synced: totalSynced };
}

export async function syncComments(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: YouTubeConfig
): Promise<{ synced: number }> {
  // Get recent videos to fetch comments for
  const recentVideos = await getYouTubeVideosForUser(db, userId, {
    integrationId,
    sortBy: "published_at",
    sortDirection: "desc",
    limit: 50,
  });

  if (recentVideos.length === 0) return { synced: 0 };

  let totalSynced = 0;

  for (const videoData of recentVideos) {
    try {
      // Limit to first page of comments per video to manage API quota
      const { comments } = await getVideoComments(
        config,
        videoData.video_id
      );

      const batch = db.batch();
      for (const thread of comments) {
        const snippet = thread.snippet.topLevelComment.snippet;
        const commentData = {
          user_id: userId,
          integration_id: integrationId,
          video_id: videoData.video_id,
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
        };

        // Find existing comment or create new
        const existingSnapshot = await db
          .collection(COLLECTIONS.YOUTUBE_COMMENTS)
          .where("user_id", "==", userId)
          .where("comment_id", "==", thread.snippet.topLevelComment.id)
          .get();

        if (!existingSnapshot.empty) {
          batch.set(existingSnapshot.docs[0].ref, commentData, { merge: true });
        } else {
          const newDocRef = db.collection(COLLECTIONS.YOUTUBE_COMMENTS).doc();
          batch.set(newDocRef, commentData);
        }
        totalSynced++;
      }
      await batch.commit();
    } catch (error) {
      // Comments may be disabled on some videos -- skip and continue
      log.warn(`Failed to sync comments for video ${videoData.video_id}:`, error);
    }
  }

  return { synced: totalSynced };
}

export async function syncAnalytics(
  db: Firestore,
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

  const batch = db.batch();
  for (const row of analytics.rows || []) {
    // Row order matches dimensions=day + metrics order:
    // [day, views, estimatedMinutesWatched, subscribersGained, subscribersLost,
    //  likes, dislikes, comments, shares, averageViewDuration]
    const analyticsData = {
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
    };

    // Find existing analytics or create new
    const existingSnapshot = await db
      .collection(COLLECTIONS.YOUTUBE_ANALYTICS)
      .where("user_id", "==", userId)
      .where("channel_id", "==", channelId)
      .where("metric_date", "==", row[0])
      .get();

    if (!existingSnapshot.empty) {
      batch.set(existingSnapshot.docs[0].ref, analyticsData, { merge: true });
    } else {
      const newDocRef = db.collection(COLLECTIONS.YOUTUBE_ANALYTICS).doc();
      batch.set(newDocRef, analyticsData);
    }
    synced++;
  }
  await batch.commit();

  return { synced };
}

export async function runFullSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: YouTubeConfig
) {
  // 1. Sync channel info
  const { channelId } = await syncChannel(
    db,
    userId,
    integrationId,
    config
  );

  // 2. Sync videos
  const videos = await syncVideos(
    db,
    userId,
    integrationId,
    config,
    channelId
  );

  // 3. Sync comments for recent videos
  const comments = await syncComments(db, userId, integrationId, config);

  // 4. Sync analytics time-series
  const analytics = await syncAnalytics(
    db,
    userId,
    integrationId,
    config,
    channelId
  );

  // 5. Persist any refreshed tokens
  await persistRefreshedTokens(
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

  let insightsGenerated = 0;
  try {
    const insightResult = await generateYouTubeInsights(
      db,
      userId,
      integrationId
    );
    insightsGenerated = insightResult.created;
  } catch (error) {
    log.error("YouTube insight generation failed:", error);
  }

  return {
    channelId,
    videos: videos.synced,
    comments: comments.synced,
    analytics: analytics.synced,
    insights: insightsGenerated,
  };
}
