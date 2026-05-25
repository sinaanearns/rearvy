import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";

const EXCHANGE_LIMIT_WINDOW_MS = 60_000;
const EXCHANGE_LIMIT_MAX = 12;
const exchangeAttempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitKey(request: NextRequest, uid: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `${uid}:${forwardedFor || realIp || "unknown"}`;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = exchangeAttempts.get(key);

  if (!current || current.resetAt <= now) {
    exchangeAttempts.set(key, {
      count: 1,
      resetAt: now + EXCHANGE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (current.count >= EXCHANGE_LIMIT_MAX) {
    return true;
  }

  current.count += 1;
  exchangeAttempts.set(key, current);
  return false;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.error) {
    return authResult.error;
  }

  const key = rateLimitKey(request, authResult.user.uid);
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: "Too many desktop sign-in attempts. Try again shortly." },
      { status: 429 }
    );
  }

  let customToken: string;
  try {
    customToken = await adminAuth.createCustomToken(authResult.user.uid, {
      source: "rearvy-desktop-browser-handoff",
    });
  } catch (error) {
    console.error("Failed to create desktop auth custom token:", error);
    return NextResponse.json(
      { error: "Desktop sign-in is not configured on this server." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    customToken,
    uid: authResult.user.uid,
  });
}
