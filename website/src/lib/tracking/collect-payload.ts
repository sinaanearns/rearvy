import { isRecord } from "@/lib/api/request-body";
import { parseJsonRecord } from "@/lib/ai/json-object";

export type TrackingEvent = {
  type: "pageview" | "custom" | "scroll" | "click";
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

export type TrackingPayload = {
  site_id?: unknown;
  tracking_token?: unknown;
  events?: unknown;
};

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

export function isTrackingEvent(value: unknown): value is TrackingEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.type !== "pageview" &&
    value.type !== "custom" &&
    value.type !== "scroll" &&
    value.type !== "click"
  ) {
    return false;
  }

  return (
    typeof value.visitor_id === "string" &&
    typeof value.session_id === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.url === "string" &&
    isOptionalString(value.path) &&
    isOptionalString(value.title) &&
    isOptionalString(value.referrer) &&
    isOptionalString(value.event_name) &&
    (value.properties === undefined || isRecord(value.properties)) &&
    isOptionalString(value.utm_source) &&
    isOptionalString(value.utm_medium) &&
    isOptionalString(value.utm_campaign) &&
    isOptionalString(value.utm_term) &&
    isOptionalString(value.utm_content) &&
    isOptionalString(value.device_type) &&
    isOptionalString(value.browser) &&
    isOptionalString(value.os) &&
    isOptionalNumber(value.screen_width) &&
    isOptionalNumber(value.screen_height)
  );
}

export function parseTrackingPayload(text: string): TrackingPayload | null {
  return parseJsonRecord(text);
}

export function parseTrackingPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}
