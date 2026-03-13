import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    // Get the active YouTube integration
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "youtube")
      .where("status", "==", "active")
      .get();

    if (integrationSnapshot.empty) {
      return NextResponse.json(
        { error: "No active YouTube integration found" },
        { status: 404 }
      );
    }

    const integration = integrationSnapshot.docs[0].data();
    const channelId = integration.provider_account_id;

    // Get channel data
    const channelSnapshot = await adminDb
      .collection(COLLECTIONS.YOUTUBE_CHANNELS)
      .where("user_id", "==", user.uid)
      .where("channel_id", "==", channelId)
      .get();

    if (channelSnapshot.empty) {
      return NextResponse.json(
        { error: "Channel data not found. Please sync your YouTube data first." },
        { status: 404 }
      );
    }

    const channelData = channelSnapshot.docs[0].data();

    // Get recent videos (last 20)
    const videosSnapshot = await adminDb
      .collection(COLLECTIONS.YOUTUBE_VIDEOS)
      .where("user_id", "==", user.uid)
      .where("channel_id", "==", channelId)
      .orderBy("synced_at", "desc")
      .limit(20)
      .get();

    const videos = videosSnapshot.docs.map((doc) => doc.data());

    // Get recent analytics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const analyticsSnapshot = await adminDb
      .collection(COLLECTIONS.YOUTUBE_ANALYTICS)
      .where("user_id", "==", user.uid)
      .where("channel_id", "==", channelId)
      .where("metric_date", ">=", thirtyDaysAgo.toISOString().split("T")[0])
      .get();

    const analytics = analyticsSnapshot.docs.map((doc) => doc.data());

    // Calculate summary metrics
    const totalViews = analytics.reduce((sum, a) => sum + ((a.views as number) || 0), 0);
    const totalSubscribersGained = analytics.reduce((sum, a) => sum + ((a.subscribers_gained as number) || 0), 0);
    const totalSubscribersLost = analytics.reduce((sum, a) => sum + ((a.subscribers_lost as number) || 0), 0);
    const avgViewDuration = analytics.length > 0
      ? analytics.reduce((sum, a) => sum + ((a.average_view_duration as number) || 0), 0) / analytics.length
      : 0;

    return NextResponse.json({
      channel: {
        id: channelData.channel_id,
        title: channelData.title,
        description: channelData.description,
        customUrl: channelData.custom_url,
        thumbnailUrl: channelData.thumbnail_url,
        country: channelData.country,
        publishedAt: channelData.published_at,
        subscriberCount: channelData.subscriber_count,
        videoCount: channelData.video_count,
        viewCount: channelData.view_count,
        lastSynced: channelData.synced_at,
      },
      recentVideos: videos,
      analytics: {
        last30Days: analytics,
        summary: {
          totalViews,
          totalSubscribersGained,
          totalSubscribersLost,
          netSubscriberGrowth: totalSubscribersGained - totalSubscribersLost,
          averageViewDuration: Math.round(avgViewDuration),
        },
      },
      integration: {
        status: integration.status,
        lastSyncedAt: integration.last_synced_at,
        accountName: integration.provider_account_name,
      },
    });
  } catch (error) {
    console.error("YouTube channel data error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch channel data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
