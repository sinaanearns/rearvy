import type { Firestore } from "firebase-admin/firestore";
import {
  fetchBasicMetrics,
  GA4Config,
  ensureValidToken,
} from "./client";
import { COLLECTIONS } from "@/lib/firebase/schema";

/**
 * Full sync for Google Analytics (GA4).
 * Fetches metrics and stores them in Firestore business_metrics collection.
 */
export async function runFullSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: GA4Config
): Promise<{ metrics: number }> {
  // Get the property ID from the integration record
  const integrationDoc = await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .get();

  const integration = integrationDoc.data();
  const propertyId =
    typeof integration?.provider_account_id === "string"
      ? integration.provider_account_id
      : "";
  if (!propertyId) {
    throw new Error("GA4 property ID not found in integration record");
  }

  // Ensure we have a valid access token
  const accessToken = await ensureValidToken(db, integrationId, config);
  const validConfig = { ...config, accessToken };

  // Sync last 30 days of metrics
  const endDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const metrics = await fetchBasicMetrics(
    validConfig,
    propertyId,
    startDate,
    endDate
  );

  // Store metrics in Firestore business_metrics collection
  const batch = db.batch();
  const periodStart = `${startDate}T00:00:00Z`;
  const periodEnd = `${endDate}T23:59:59Z`;
  const metricsData = [
    {
      user_id: userId,
      integration_id: integrationId,
      metric_type: "page_views",
      metric_value: metrics.pageViews,
      dimensions: { source: "google_analytics", property_id: propertyId },
      period_start: periodStart,
      period_end: periodEnd,
      granularity: "daily",
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      user_id: userId,
      integration_id: integrationId,
      metric_type: "sessions",
      metric_value: metrics.sessions,
      dimensions: { source: "google_analytics", property_id: propertyId },
      period_start: periodStart,
      period_end: periodEnd,
      granularity: "daily",
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];

  for (const metric of metricsData) {
    const docRef = db.collection(COLLECTIONS.BUSINESS_METRICS).doc();
    batch.set(docRef, metric);
  }
  await batch.commit();

  // Update last_synced_at
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({ last_synced_at: new Date().toISOString() });

  return { metrics: metricsData.length };
}
