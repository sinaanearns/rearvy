import type { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const GA4_ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";
const GA4_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

export interface GA4Config {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

export interface RefreshedTokens {
  accessToken: string;
  expiresAt: Date;
}

// GA4 Admin API response types

export interface GA4Property {
  name: string; // Format: properties/{property_id}
  parent: string; // Format: accounts/{account_id}
  displayName: string;
  propertyType: "PROPERTY_TYPE_ORDINARY" | "PROPERTY_TYPE_SUBPROPERTY" | "PROPERTY_TYPE_ROLLUP";
  createTime: string;
  updateTime: string;
  industryCategory?: string;
  timeZone: string;
  currencyCode: string;
}

export interface GA4AccountSummary {
  name: string; // Format: accountSummaries/{account_id}
  account: string; // Format: accounts/{account_id}
  displayName: string;
  propertySummaries: Array<{
    property: string; // Format: properties/{property_id}
    displayName: string;
  }>;
}

export interface GA4PropertyInfo {
  propertyId: string;
  displayName: string;
  timeZone: string;
  currencyCode: string;
}

// GA4 Data API types

export interface GA4MetricValue {
  value: string;
}

export interface GA4DimensionValue {
  value: string;
}

export interface GA4Row {
  dimensionValues: GA4DimensionValue[];
  metricValues: GA4MetricValue[];
}

export interface GA4RunReportResponse {
  dimensionHeaders: Array<{ name: string }>;
  metricHeaders: Array<{ name: string; type: string }>;
  rows: GA4Row[];
  rowCount: number;
  metadata: {
    currencyCode?: string;
    timeZone?: string;
  };
}

/**
 * Get property info from GA4 Admin API.
 */
export async function getPropertyInfo(
  config: GA4Config
): Promise<GA4PropertyInfo> {
  // First, fetch all account summaries to find properties
  const summaryRes = await fetch(
    `${GA4_ADMIN_API}/accountSummaries?pageSize=50`,
    {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    }
  );

  if (!summaryRes.ok) {
    const details = await summaryRes.text();
    throw new Error(
      `Failed to fetch account summaries: ${summaryRes.status} ${summaryRes.statusText}${details ? ` - ${details}` : ""}`
    );
  }

  const summaryData = await summaryRes.json();
  const summaries: GA4AccountSummary[] = summaryData.accountSummaries || [];

  if (summaries.length === 0 || !summaries[0].propertySummaries?.length) {
    throw new Error("No GA4 properties found in this account.");
  }

  // Use the first property found
  const firstPropertySummary = summaries[0].propertySummaries[0];
  const propertyResource = firstPropertySummary.property; // Format: properties/{property_id}

  // Fetch detailed property info
  const propertyRes = await fetch(`${GA4_ADMIN_API}/${propertyResource}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!propertyRes.ok) {
    const details = await propertyRes.text();
    throw new Error(
      `Failed to fetch property details: ${propertyRes.status} ${propertyRes.statusText}${details ? ` - ${details}` : ""}`
    );
  }

  const property: GA4Property = await propertyRes.json();

  // Extract property ID from name (format: properties/123456789)
  const propertyId = property.name.split("/")[1];

  return {
    propertyId,
    displayName: property.displayName,
    timeZone: property.timeZone,
    currencyCode: property.currencyCode,
  };
}

/**
 * Refresh expired access token using refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshedTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Ensure we have a valid access token, refreshing if necessary.
 * Updates the integration record in Firestore if token was refreshed.
 */
export async function ensureValidToken(
  db: Firestore,
  integrationId: string,
  config: GA4Config
): Promise<string> {
  const now = new Date();
  const bufferMinutes = 5;
  const expiresWithBuffer = new Date(
    config.tokenExpiresAt.getTime() - bufferMinutes * 60 * 1000
  );

  if (now < expiresWithBuffer) {
    return config.accessToken;
  }

  // Token expired or about to expire; refresh it
  const { accessToken, expiresAt } = await refreshAccessToken(
    config.refreshToken
  );

  // Encrypt and update in database
  const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(accessToken);

  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({
      access_token_enc: accessTokenEnc,
      token_iv: accessIv,
      token_expires_at: expiresAt.toISOString(),
    });

  return accessToken;
}

/**
 * Run a GA4 Data API report query.
 */
export async function runReport(
  config: GA4Config,
  propertyId: string,
  params: {
    dateRanges: Array<{ startDate: string; endDate: string }>;
    dimensions?: Array<{ name: string }>;
    metrics: Array<{ name: string }>;
    limit?: number;
    offset?: number;
  }
): Promise<GA4RunReportResponse> {
  const res = await fetch(
    `${GA4_DATA_API}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: params.dateRanges,
        dimensions: params.dimensions || [],
        metrics: params.metrics,
        limit: params.limit || 100,
        offset: params.offset || 0,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 runReport failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Fetch basic metrics from GA4 (e.g., sessions, page views, users).
 */
export async function fetchBasicMetrics(
  config: GA4Config,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{
  sessions: number;
  pageViews: number;
  activeUsers: number;
  avgSessionDuration: number;
}> {
  const report = await runReport(config, propertyId, {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "activeUsers" },
      { name: "averageSessionDuration" },
    ],
  });

  if (!report.rows || report.rows.length === 0) {
    return {
      sessions: 0,
      pageViews: 0,
      activeUsers: 0,
      avgSessionDuration: 0,
    };
  }

  const row = report.rows[0];
  return {
    sessions: parseInt(row.metricValues[0].value, 10) || 0,
    pageViews: parseInt(row.metricValues[1].value, 10) || 0,
    activeUsers: parseInt(row.metricValues[2].value, 10) || 0,
    avgSessionDuration: parseFloat(row.metricValues[3].value) || 0,
  };
}
