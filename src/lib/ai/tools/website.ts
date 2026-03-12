import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

export function getWebsiteOverview(ctx: ToolContext) {
  return tool({
    description:
      "Get website analytics overview: total visits, unique visitors, pageviews, average pageviews per session for a tracked website",
    inputSchema: z.object({
      days: z
        .number()
        .optional()
        .default(30)
        .describe("Number of recent days to include"),
      domain: z
        .string()
        .optional()
        .describe("Filter to a specific website domain"),
    }),
    execute: async ({ days, domain }) => {
      let websiteQuery = ctx.adminDb
        .collection(COLLECTIONS.WEBSITES)
        .where("user_id", "==", ctx.userId);
      if (domain) websiteQuery = websiteQuery.where("domain", "==", domain);
      const websiteSnap = await websiteQuery.get();
      const websites = websiteSnap.docs.map((doc) => doc.data() as any);

      if (!websites || websites.length === 0) {
        return {
          message:
            "No tracked websites found. Add a website in Integrations first.",
        };
      }

      const websiteIds = websites.map((w) => w.id);
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

      const sessionSnap = await ctx.adminDb
        .collection(COLLECTIONS.WEBSITE_SESSIONS)
        .where("user_id", "==", ctx.userId)
        .where("website_id", "in", websiteIds)
        .where("started_at", ">=", sinceDate)
        .get();
      const sessionCount = sessionSnap.size;
      const sessions = sessionSnap.docs.map((doc) => doc.data() as any);

      const uniqueVisitors = new Set(
        (sessions || []).map((v) => v.visitor_id)
      ).size;

      const pageviewSnap = await ctx.adminDb
        .collection(COLLECTIONS.WEBSITE_PAGEVIEWS)
        .where("user_id", "==", ctx.userId)
        .where("website_id", "in", websiteIds)
        .where("timestamp", ">=", sinceDate)
        .get();
      const pageviewCount = pageviewSnap.size;

      return {
        websites: websites.map((w) => ({ domain: w.domain, name: w.name })),
        period: { days },
        totalSessions: sessionCount || 0,
        uniqueVisitors,
        totalPageviews: pageviewCount || 0,
        avgPageviewsPerSession: sessionCount
          ? Math.round(((pageviewCount || 0) / sessionCount) * 100) / 100
          : 0,
      };
    },
  });
}

export function getTopPages(ctx: ToolContext) {
  return tool({
    description:
      "Get most visited pages on tracked website with view counts",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      limit: z.number().optional().default(10),
      domain: z.string().optional(),
    }),
    execute: async ({ days, limit, domain }) => {
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

      let websiteQuery = ctx.adminDb
        .collection(COLLECTIONS.WEBSITES)
        .where("user_id", "==", ctx.userId);
      if (domain) websiteQuery = websiteQuery.where("domain", "==", domain);
      const websiteSnap = await websiteQuery.get();
      const websites = websiteSnap.docs.map((doc) => doc.data() as any);
      if (!websites?.length) return { pages: [] };

      const websiteIds = websites.map((w: any) => w.id);

      const pageviewSnap = await ctx.adminDb
        .collection(COLLECTIONS.WEBSITE_PAGEVIEWS)
        .where("user_id", "==", ctx.userId)
        .where("website_id", "in", websiteIds)
        .where("timestamp", ">=", sinceDate)
        .get();
      const pageviews = pageviewSnap.docs.map((doc) => doc.data() as any);

      const pageCounts = new Map<
        string,
        { count: number; title: string | null }
      >();
      for (const pv of pageviews || []) {
        const existing = pageCounts.get(pv.path);
        if (existing) {
          existing.count++;
        } else {
          pageCounts.set(pv.path, { count: 1, title: pv.title });
        }
      }

      const sorted = [...pageCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit);

      return {
        pages: sorted.map(([path, data]) => ({
          path,
          title: data.title,
          views: data.count,
        })),
      };
    },
  });
}

export function getTrafficSources(ctx: ToolContext) {
  return tool({
    description:
      "Get traffic sources breakdown: referrers and UTM parameters",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ days, limit }) => {
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

      const sessionSnap = await ctx.adminDb
        .collection(COLLECTIONS.WEBSITE_SESSIONS)
        .where("user_id", "==", ctx.userId)
        .where("started_at", ">=", sinceDate)
        .get();
      const sessions = sessionSnap.docs.map((doc) => doc.data() as any);

      const refCounts = new Map<string, number>();
      const utmCounts = new Map<string, number>();

      for (const s of sessions || []) {
        const ref = s.referrer || "(direct)";
        refCounts.set(ref, (refCounts.get(ref) || 0) + 1);
        if (s.utm_source) {
          const key = [s.utm_source, s.utm_medium, s.utm_campaign]
            .filter(Boolean)
            .join(" / ");
          utmCounts.set(key, (utmCounts.get(key) || 0) + 1);
        }
      }

      return {
        referrers: [...refCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([source, count]) => ({ source, sessions: count })),
        utmCampaigns: [...utmCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([campaign, count]) => ({ campaign, sessions: count })),
      };
    },
  });
}

export function getWebsiteEvents(ctx: ToolContext) {
  return tool({
    description: "Get custom event analytics from tracked website",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      eventName: z
        .string()
        .optional()
        .describe("Filter to specific event name"),
      limit: z.number().optional().default(20),
    }),
    execute: async ({ days, eventName, limit }) => {
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

      let query = ctx.adminDb
        .collection(COLLECTIONS.WEBSITE_EVENTS)
        .where("user_id", "==", ctx.userId)
        .where("event_type", "==", "custom")
        .where("timestamp", ">=", sinceDate)
        .orderBy("timestamp", "desc")
        .limit(limit);

      if (eventName) query = query.where("event_name", "==", eventName);

      const snapshot = await query.get();
      const data = snapshot.docs.map((doc) => doc.data() as any);

      if (!data?.length)
        return { events: [], message: "No custom events found." };

      const nameCounts = new Map<string, number>();
      for (const e of data) {
        const n = e.event_name || "(unnamed)";
        nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
      }

      return {
        events: data,
        summary: [...nameCounts.entries()].map(([name, count]) => ({
          name,
          count,
        })),
      };
    },
  });
}

export function getClickAnalytics(ctx: ToolContext) {
  return tool({
    description: "Get most clicked elements on tracked website",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      limit: z.number().optional().default(15),
      page: z
        .string()
        .optional()
        .describe("Filter clicks to a specific page path"),
    }),
    execute: async ({ days, limit, page }) => {
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

      let query = ctx.adminDb
        .collection(COLLECTIONS.WEBSITE_EVENTS)
        .where("user_id", "==", ctx.userId)
        .where("event_type", "==", "click")
        .where("timestamp", ">=", sinceDate);

      const snapshot = await query.get();
      let data = snapshot.docs.map((doc) => doc.data() as any);
      if (page) data = data.filter((evt: any) => evt.url?.includes(page));

      const clickMap = new Map<
        string,
        { count: number; tag: string; href: string | null; text: string }
      >();
      for (const evt of data || []) {
        const p = evt.properties as Record<string, unknown>;
        const text = ((p.text as string) || "").substring(0, 60);
        const key = `${p.tag || ""}:${text}:${p.href || ""}`;
        const existing = clickMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          clickMap.set(key, {
            count: 1,
            tag: (p.tag as string) || "",
            href: (p.href as string) || null,
            text,
          });
        }
      }

      return {
        clicks: [...clickMap.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, limit)
          .map(([, data]) => ({
            element: data.text || data.tag,
            tag: data.tag,
            href: data.href,
            clicks: data.count,
          })),
      };
    },
  });
}

export function getScrollDepthAnalytics(ctx: ToolContext) {
  return tool({
    description:
      "Get scroll depth analytics showing how far users scroll on each page",
    inputSchema: z.object({
      days: z.number().optional().default(30),
      page: z
        .string()
        .optional()
        .describe("Filter to a specific page path"),
    }),
    execute: async ({ days, page }) => {
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

      let query = ctx.adminDb
        .collection(COLLECTIONS.WEBSITE_EVENTS)
        .where("user_id", "==", ctx.userId)
        .where("event_type", "==", "scroll")
        .where("timestamp", ">=", sinceDate);

      const snapshot = await query.get();
      let data = snapshot.docs.map((doc) => doc.data() as any);
      if (page) data = data.filter((evt: any) => evt.url?.includes(page));

      const depthCounts: Record<number, number> = { 25: 0, 50: 0, 75: 0, 100: 0 };
      let total = 0;
      for (const evt of data || []) {
        const depth = (evt.properties as Record<string, unknown>)
          .depth as number;
        if (depth && depth in depthCounts) {
          depthCounts[depth]++;
          total++;
        }
      }

      return {
        totalScrollEvents: total,
        thresholds: Object.entries(depthCounts).map(([depth, count]) => ({
          depth: Number(depth),
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        })),
      };
    },
  });
}
