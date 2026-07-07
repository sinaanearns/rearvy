import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import {
  listCalendarEvents,
  createCalendarEvent as apiCreateCalendarEvent,
  updateCalendarEvent as apiUpdateCalendarEvent,
} from "@/lib/integrations/google-calendar/client";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("CalendarTool");

export function getCalendarEvents(ctx: ToolContext) {
  return tool({
    description: "List scheduled Google Calendar events",
    inputSchema: z.object({
      timeMin: z
        .string()
        .optional()
        .describe("Optional start timestamp in ISO format (e.g. '2026-07-01T00:00:00Z')"),
      timeMax: z
        .string()
        .optional()
        .describe("Optional end timestamp in ISO format (e.g. '2026-07-07T23:59:59Z')"),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ timeMin, timeMax, limit }) => {
      try {
        const data = await listCalendarEvents({
          userId: ctx.userId,
          timeMin,
          timeMax,
          maxResults: limit,
        });

        const events = (data.items || []).map((item: any) => ({
          id: item.id,
          summary: item.summary || "No Title",
          description: item.description || "",
          location: item.location || "",
          start: item.start?.dateTime || item.start?.date || "",
          end: item.end?.dateTime || item.end?.date || "",
        }));

        return { ok: true, events };
      } catch (error) {
        log.error("Failed to retrieve calendar events", error);
        return { ok: false, error: error instanceof Error ? error.message : "Lookup failed" };
      }
    },
  });
}

export function createCalendarEvent(ctx: ToolContext) {
  return tool({
    description: "Create a new meeting or task on Google Calendar",
    inputSchema: z.object({
      summary: z.string().describe("Title of the event"),
      description: z.string().optional().describe("Description detailing context"),
      startTime: z.string().describe("ISO start timestamp (e.g. '2026-07-05T10:00:00Z')"),
      endTime: z.string().describe("ISO end timestamp (e.g. '2026-07-05T11:00:00Z')"),
      location: z.string().optional().describe("Physical location or call link"),
    }),
    execute: async ({ summary, description, startTime, endTime, location }) => {
      try {
        const result = await apiCreateCalendarEvent({
          userId: ctx.userId,
          event: { summary, description, startTime, endTime, location },
        });

        return {
          ok: true,
          eventId: result.id,
          htmlLink: result.htmlLink,
          message: `Successfully scheduled calendar event: "${summary}"`,
        };
      } catch (error) {
        log.error("Failed to create calendar event", error);
        return { ok: false, error: error instanceof Error ? error.message : "Creation failed" };
      }
    },
  });
}

export function updateCalendarEvent(ctx: ToolContext) {
  return tool({
    description: "Modify an existing Google Calendar event properties",
    inputSchema: z.object({
      eventId: z.string().describe("Unique ID of the event to edit"),
      summary: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      startTime: z.string().optional().describe("New ISO start timestamp"),
      endTime: z.string().optional().describe("New ISO end timestamp"),
      location: z.string().optional().describe("New location"),
    }),
    execute: async ({ eventId, summary, description, startTime, endTime, location }) => {
      try {
        const result = await apiUpdateCalendarEvent({
          userId: ctx.userId,
          eventId,
          event: { summary, description, startTime, endTime, location },
        });

        return {
          ok: true,
          eventId: result.id,
          message: `Successfully updated calendar event: "${result.summary || "Event"}"`,
        };
      } catch (error) {
        log.error("Failed to update calendar event", error);
        return { ok: false, error: error instanceof Error ? error.message : "Update failed" };
      }
    },
  });
}

export function findFreeTime(ctx: ToolContext) {
  return tool({
    description: "Analyze calendar blocks to check for availability and find free slots",
    inputSchema: z.object({
      startTime: z.string().describe("ISO start window to inspect"),
      endTime: z.string().describe("ISO end window to inspect"),
    }),
    execute: async ({ startTime, endTime }) => {
      try {
        const data = await listCalendarEvents({
          userId: ctx.userId,
          timeMin: startTime,
          timeMax: endTime,
          maxResults: 100,
        });

        const busySlots = (data.items || []).map((item: any) => ({
          start: new Date(item.start?.dateTime || item.start?.date).getTime(),
          end: new Date(item.end?.dateTime || item.end?.date).getTime(),
        }));

        return {
          ok: true,
          inspectingWindow: { startTime, endTime },
          busyCount: busySlots.length,
          busyBlocks: (data.items || []).map((item: any) => ({
            summary: item.summary || "Busy",
            start: item.start?.dateTime || item.start?.date,
            end: item.end?.dateTime || item.end?.date,
          })),
        };
      } catch (error) {
        log.error("Failed to check free time", error);
        return { ok: false, error: error instanceof Error ? error.message : "Availability check failed" };
      }
    },
  });
}
