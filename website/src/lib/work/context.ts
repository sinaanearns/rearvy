import type { NextRequest } from "next/server";

export type WorkContextLocation = {
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

function decodeHeader(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getRequestLocation(request: NextRequest): WorkContextLocation {
  return {
    city:
      decodeHeader(request.headers.get("x-vercel-ip-city")) ||
      decodeHeader(request.headers.get("cf-ipcity")),
    region:
      decodeHeader(request.headers.get("x-vercel-ip-country-region")) ||
      decodeHeader(request.headers.get("cf-region")),
    country:
      decodeHeader(request.headers.get("x-vercel-ip-country")) ||
      decodeHeader(request.headers.get("cf-ipcountry")),
    latitude:
      parseNumber(request.headers.get("x-vercel-ip-latitude")) ||
      parseNumber(request.headers.get("cf-iplatitude")),
    longitude:
      parseNumber(request.headers.get("x-vercel-ip-longitude")) ||
      parseNumber(request.headers.get("cf-iplongitude")),
  };
}

export async function getWeatherSummary(location: WorkContextLocation) {
  if (location.latitude === null || location.longitude === null) {
    return {
      status: "unavailable",
      reason: "Approximate latitude and longitude were not available from request headers.",
    };
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return { status: "unavailable", reason: "Weather provider request failed." };
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    status: "available",
    provider: "open-meteo",
    current:
      payload.current && typeof payload.current === "object" && !Array.isArray(payload.current)
        ? payload.current
        : null,
  };
}
