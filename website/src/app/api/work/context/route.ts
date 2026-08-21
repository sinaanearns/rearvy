import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getRequestLocation, getWeatherSummary } from "@/lib/work/context";

export const runtime = "nodejs";

function formatLocalTime(date: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "UTC",
    }).format(date);
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const profileSnapshot = await adminDb.collection(COLLECTIONS.PROFILES).doc(auth.user.uid).get();
  const profile = profileSnapshot.data() || {};
  const timezone = typeof profile.timezone === "string" && profile.timezone ? profile.timezone : "UTC";
  const now = new Date();
  const location = getRequestLocation(request);
  const weather = await getWeatherSummary(location).catch(() => ({
    status: "unavailable",
    reason: "Weather lookup failed.",
  }));

  return NextResponse.json({
    time: {
      iso: now.toISOString(),
      timezone,
      local: formatLocalTime(now, timezone),
    },
    location,
    weather,
  });
}
