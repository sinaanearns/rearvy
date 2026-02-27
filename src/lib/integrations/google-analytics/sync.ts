import { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchBasicMetrics,
  GA4Config,
  ensureValidToken,
} from "./client";

/**
 * Full sync for Google Analytics (GA4).
 * Fetches metrics and stores them in business_metrics table.
 */
export async function runFullSync(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: GA4Config
): Promise<{ metrics: number }> {
  // Get the property ID from the integration record
  const { data: integration } = await supabase
    .from("integrations")
    .select("provider_account_id")
    .eq("id", integrationId)
    .single();

  if (!integration?.provider_account_id) {
    throw new Error("GA4 property ID not found in integration record");
  }

  const propertyId = integration.provider_account_id;

  // Ensure we have a valid access token
  const accessToken = await ensureValidToken(supabase, integrationId, config);
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

  // Store metrics in business_metrics table
  const metricsToInsert = [
    {
      user_id: userId,
      integration_id: integrationId,
      metric_type: "page_views",
      value: metrics.pageViews,
      date: endDate,
      metadata: { source: "google_analytics", property_id: propertyId },
    },
    {
      user_id: userId,
      integration_id: integrationId,
      metric_type: "sessions",
      value: metrics.sessions,
      date: endDate,
      metadata: { source: "google_analytics", property_id: propertyId },
    },
  ];

  await supabase.from("business_metrics").upsert(metricsToInsert, {
    onConflict: "user_id,integration_id,metric_type,date",
  });

  // Update last_synced_at
  await supabase
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", integrationId);

  return { metrics: metricsToInsert.length };
}
