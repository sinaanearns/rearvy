import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { safeDocId } from '@/lib/firebase/doc-utils';

type SiteInfo = { websiteId: string; userId: string; trackingSecret: string | null; expiresAt: number };
const siteCache = new Map<string, SiteInfo>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

type TrackingEvent = {
  type: string;
  visitor_id: string;
  session_id: string;
  timestamp: string;
  url: string;
  path?: string;
  title?: string;
  referrer?: string;
  event_name?: string;
  properties?: Record<string, unknown>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  screen_width?: number;
  screen_height?: number;
};

async function resolveSiteId(
  siteId: string
): Promise<{ websiteId: string; userId: string; trackingSecret: string | null } | null> {
  const now = Date.now();
  const cached = siteCache.get(siteId);
  if (cached && cached.expiresAt > now) {
    return {
      websiteId: cached.websiteId,
      userId: cached.userId,
      trackingSecret: cached.trackingSecret,
    };
  }

  const websitesSnapshot = await adminDb
    .collection(COLLECTIONS.WEBSITES)
    .where("site_id", "==", siteId)
    .where("is_active", "==", true)
    .limit(1)
    .get();

  if (websitesSnapshot.empty) return null;

  const websiteDoc = websitesSnapshot.docs[0];
  const websiteData = websiteDoc.data();
  const websiteId = websiteDoc.id;
  const userId = websiteData.user_id;
  const trackingSecret = typeof websiteData.tracking_secret === "string" ? websiteData.tracking_secret : null;

  siteCache.set(siteId, {
    websiteId,
    userId,
    trackingSecret,
    expiresAt: now + CACHE_TTL_MS,
  });

  return { websiteId, userId, trackingSecret };
}

function parsePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

export async function POST(request: NextRequest) {
  try {
    // Accept both application/json and text/plain (sendBeacon sends text/plain)
    const text = await request.text();
    const payload = JSON.parse(text) as {
      site_id?: string;
      tracking_token?: string;
      events?: TrackingEvent[];
    };

    const { site_id, tracking_token, events } = payload;
    if (!site_id || !Array.isArray(events) || events.length === 0) {
      return new Response(null, { status: 400, headers: CORS_HEADERS });
    }

    if (events.length > 50) {
      return new Response(null, { status: 400, headers: CORS_HEADERS });
    }

    const siteInfo = await resolveSiteId(site_id);
    if (!siteInfo) {
      return new Response(null, { status: 404, headers: CORS_HEADERS });
    }

    const { websiteId, userId, trackingSecret } = siteInfo;
    if (!trackingSecret || tracking_token !== trackingSecret) {
      return new Response(null, { status: 401, headers: CORS_HEADERS });
    }

    const pageviews: Record<string, unknown>[] = [];
    const sessions: Record<string, unknown>[] = [];
    const eventRows: Record<string, unknown>[] = [];

    for (const evt of events) {
      const base = {
        website_id: websiteId,
        user_id: userId,
        session_id: evt.session_id,
        visitor_id: evt.visitor_id,
        timestamp: evt.timestamp,
      };

      if (evt.type === "pageview") {
        const path = evt.path || parsePath(evt.url);
        pageviews.push({
          ...base,
          url: evt.url,
          path,
          title: evt.title || null,
          referrer: evt.referrer || null,
        });
        sessions.push({
          ...base,
          referrer: evt.referrer || null,
          utm_source: evt.utm_source || null,
          utm_medium: evt.utm_medium || null,
          utm_campaign: evt.utm_campaign || null,
          utm_term: evt.utm_term || null,
          utm_content: evt.utm_content || null,
          device_type: evt.device_type || null,
          browser: evt.browser || null,
          os: evt.os || null,
          screen_width: evt.screen_width || null,
          screen_height: evt.screen_height || null,
          entry_page: path,
          started_at: evt.timestamp,
          page_count: 1,
        });
      } else {
        eventRows.push({
          ...base,
          event_type: evt.type === "custom" ? "custom" : evt.type === "scroll" ? "scroll" : "click",
          event_name: evt.event_name || null,
          properties: evt.properties || {},
          url: evt.url || null,
        });
      }
    }

    const batch = adminDb.batch();

    // Add pageviews
    if (pageviews.length > 0) {
      for (const pageview of pageviews) {
        const docRef = adminDb
          .collection(COLLECTIONS.WEBSITE_PAGEVIEWS)
          .doc();
        batch.set(docRef, pageview);
      }
    }

    // Upsert sessions (merge to update if exists)
    if (sessions.length > 0) {
      for (const session of sessions) {
        const docRef = adminDb
          .collection(COLLECTIONS.WEBSITE_SESSIONS)
          .doc(safeDocId(session.session_id));
        batch.set(docRef, session, { merge: true });
      }
    }

    // Add events
    if (eventRows.length > 0) {
      for (const event of eventRows) {
        const docRef = adminDb
          .collection(COLLECTIONS.WEBSITE_EVENTS)
          .doc();
        batch.set(docRef, event);
      }
    }

    await batch.commit();

    return new Response(null, { status: 204, headers: CORS_HEADERS });
  } catch {
    // Silently fail — tracking should never break the user's site
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
}
