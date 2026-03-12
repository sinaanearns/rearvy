import { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { checkRequiredTables } from "@/lib/integrations/schema-health";

type InsightCandidate = {
  insightType: "anomaly" | "trend" | "milestone" | "opportunity" | "risk";
  severity: "info" | "notable" | "important" | "critical";
  title: string;
  summary: string;
  dataSnapshot: Record<string, unknown>;
  metricRefs?: unknown[];
  relatedEntity?: Record<string, unknown>;
};

type InsightGenerationResult = {
  created: number;
  skippedReason?: string;
};

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function percentChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function insertInsightIfFresh(
  db: Firestore,
  userId: string,
  candidate: InsightCandidate
): Promise<boolean> {
  const freshnessWindowStart = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const recentMatchSnapshot = await db
    .collection(COLLECTIONS.INSIGHTS)
    .where("user_id", "==", userId)
    .where("insight_type", "==", candidate.insightType)
    .where("title", "==", candidate.title)
    .where("generated_at", ">=", freshnessWindowStart)
    .limit(1)
    .get();

  if (!recentMatchSnapshot.empty) {
    return false;
  }

  await db.collection(COLLECTIONS.INSIGHTS).add({
    user_id: userId,
    insight_type: candidate.insightType,
    severity: candidate.severity,
    title: candidate.title,
    summary: candidate.summary,
    data_snapshot: candidate.dataSnapshot,
    metric_refs: candidate.metricRefs || [],
    related_entity: candidate.relatedEntity || null,
    is_read: false,
    is_dismissed: false,
    generated_at: new Date().toISOString(),
  });

  return true;
}

export async function generateShopifyInsights(
  db: Firestore,
  userId: string,
  integrationId: string
): Promise<InsightGenerationResult> {
  const tableHealth = await checkRequiredTables(db, [
    "insights",
    "business_metrics",
  ]);

  if (!tableHealth.ok) {
    return {
      created: 0,
      skippedReason: `Missing tables: ${tableHealth.missingTables.join(", ")}`,
    };
  }

  const revenueSnap = await db
    .collection(COLLECTIONS.BUSINESS_METRICS)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .where("metric_type", "==", "revenue")
    .where("granularity", "==", "daily")
    .orderBy("period_start", "desc")
    .limit(14)
    .get();

  const revenueRows = revenueSnap.docs.map((doc) => doc.data() as any);

  const values = (revenueRows || []).map((row) => Number(row.metric_value));
  if (values.length < 10) {
    return { created: 0 };
  }

  const recent = values.slice(0, 7);
  const previous = values.slice(7, 14);
  const recentTotal = sum(recent);
  const previousTotal = sum(previous);
  const delta = percentChange(previousTotal, recentTotal);

  let created = 0;

  if (Math.abs(delta) >= 20) {
    const direction = delta > 0 ? "up" : "down";
    const createdNow = await insertInsightIfFresh(db, userId, {
      insightType: "trend",
      severity: Math.abs(delta) >= 40 ? "important" : "notable",
      title: `Weekly revenue is ${direction} ${Math.abs(delta).toFixed(1)}%`,
      summary:
        delta > 0
          ? "Revenue accelerated versus the prior 7-day window."
          : "Revenue declined versus the prior 7-day window.",
      dataSnapshot: {
        recent7dRevenue: recentTotal,
        previous7dRevenue: previousTotal,
        percentChange: delta,
      },
      metricRefs: ["revenue"],
      relatedEntity: { type: "integration", id: integrationId },
    });
    if (createdNow) created += 1;
  }

  return { created };
}

export async function generateYouTubeInsights(
  db: Firestore,
  userId: string,
  integrationId: string
): Promise<InsightGenerationResult> {
  const tableHealth = await checkRequiredTables(db, [
    "insights",
    "youtube_analytics",
    "youtube_videos",
  ]);

  if (!tableHealth.ok) {
    return {
      created: 0,
      skippedReason: `Missing tables: ${tableHealth.missingTables.join(", ")}`,
    };
  }

  const analyticsSnapshot = await db
    .collection(COLLECTIONS.YOUTUBE_ANALYTICS)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .orderBy("metric_date", "desc")
    .limit(14)
    .get();

  const analyticsRows = analyticsSnapshot.docs.map(doc => doc.data());

  let created = 0;

  if (analyticsRows.length >= 10) {
    const views = analyticsRows.map((row) => Number(row.views || 0));
    const recentViews = sum(views.slice(0, 7));
    const previousViews = sum(views.slice(7, 14));
    const viewsDelta = percentChange(previousViews, recentViews);

    if (Math.abs(viewsDelta) >= 20) {
      const direction = viewsDelta > 0 ? "up" : "down";
      const createdNow = await insertInsightIfFresh(db, userId, {
        insightType: "trend",
        severity: Math.abs(viewsDelta) >= 40 ? "important" : "notable",
        title: `YouTube views are ${direction} ${Math.abs(viewsDelta).toFixed(1)}%`,
        summary:
          viewsDelta > 0
            ? "Channel views are accelerating versus the prior 7-day window."
            : "Channel views are softening versus the prior 7-day window.",
        dataSnapshot: {
          recent7dViews: recentViews,
          previous7dViews: previousViews,
          percentChange: viewsDelta,
        },
        metricRefs: ["views"],
        relatedEntity: { type: "integration", id: integrationId },
      });
      if (createdNow) created += 1;
    }
  }

  const topVideosSnapshot = await db
    .collection(COLLECTIONS.YOUTUBE_VIDEOS)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .orderBy("view_count", "desc")
    .limit(10)
    .get();

  const topVideos = topVideosSnapshot.docs.map(doc => doc.data());

  if (topVideos.length >= 3) {
    const totalViews = sum(topVideos.map((video) => Number(video.view_count || 0)));
    const topThreeViews = sum(
      topVideos.slice(0, 3).map((video) => Number(video.view_count || 0))
    );
    const concentrationPct = totalViews > 0 ? (topThreeViews / totalViews) * 100 : 0;

    if (concentrationPct >= 70) {
      const createdNow = await insertInsightIfFresh(db, userId, {
        insightType: "risk",
        severity: concentrationPct >= 80 ? "important" : "notable",
        title: "View concentration risk across top videos",
        summary:
          "A high share of total views comes from just a few videos, which may increase performance volatility.",
        dataSnapshot: {
          top3SharePercent: concentrationPct,
          topVideoTitles: topVideos.slice(0, 3).map((video) => video.title),
        },
        metricRefs: ["views"],
        relatedEntity: { type: "integration", id: integrationId },
      });
      if (createdNow) created += 1;
    }
  }

  return { created };
}

export async function generateInstagramInsights(
  db: Firestore,
  userId: string,
  integrationId: string
): Promise<InsightGenerationResult> {
  const tableHealth = await checkRequiredTables(db, [
    "insights",
    "instagram_analytics",
    "instagram_posts",
  ]);

  if (!tableHealth.ok) {
    return {
      created: 0,
      skippedReason: `Missing tables: ${tableHealth.missingTables.join(", ")}`,
    };
  }

  let created = 0;

  const analyticsSnapshot = await db
    .collection(COLLECTIONS.INSTAGRAM_ANALYTICS)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .orderBy("metric_date", "desc")
    .limit(14)
    .get();

  const analyticsRows = analyticsSnapshot.docs.map(doc => doc.data());

  if (analyticsRows.length >= 10) {
    const impressions = analyticsRows.map((r) => Number(r.impressions || 0));
    const recentImpressions = sum(impressions.slice(0, 7));
    const previousImpressions = sum(impressions.slice(7, 14));
    const impressionsDelta = percentChange(previousImpressions, recentImpressions);

    if (Math.abs(impressionsDelta) >= 20) {
      const direction = impressionsDelta > 0 ? "up" : "down";
      const createdNow = await insertInsightIfFresh(db, userId, {
        insightType: "trend",
        severity: Math.abs(impressionsDelta) >= 40 ? "important" : "notable",
        title: `Instagram impressions are ${direction} ${Math.abs(impressionsDelta).toFixed(1)}%`,
        summary:
          impressionsDelta > 0
            ? "Instagram impressions are trending up versus the prior 7-day window."
            : "Instagram impressions are declining versus the prior 7-day window.",
        dataSnapshot: {
          recent7dImpressions: recentImpressions,
          previous7dImpressions: previousImpressions,
          percentChange: impressionsDelta,
        },
        metricRefs: ["impressions"],
        relatedEntity: { type: "integration", id: integrationId },
      });
      if (createdNow) created += 1;
    }

    // Check follower growth anomaly
    const followers = analyticsRows.map((r) => Number(r.follower_count || 0));
    if (followers[0] > 0 && followers[followers.length - 1] > 0) {
      const followerDelta = percentChange(
        followers[followers.length - 1],
        followers[0]
      );
      if (Math.abs(followerDelta) >= 5) {
        const direction = followerDelta > 0 ? "gained" : "lost";
        const createdNow = await insertInsightIfFresh(db, userId, {
          insightType: followerDelta > 0 ? "milestone" : "risk",
          severity: Math.abs(followerDelta) >= 10 ? "important" : "notable",
          title: `Instagram ${direction} ${Math.abs(followerDelta).toFixed(1)}% followers`,
          summary:
            followerDelta > 0
              ? "Follower growth is accelerating, indicating increased audience interest."
              : "Follower count is declining, which may signal content or engagement issues.",
          dataSnapshot: {
            currentFollowers: followers[0],
            previousFollowers: followers[followers.length - 1],
            percentChange: followerDelta,
          },
          metricRefs: ["followers"],
          relatedEntity: { type: "integration", id: integrationId },
        });
        if (createdNow) created += 1;
      }
    }
  }

  return { created };
}
