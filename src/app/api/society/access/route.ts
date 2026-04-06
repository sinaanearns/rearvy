import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";

export const runtime = "nodejs";

function normalizeSocietyRoute(value: unknown) {
  if (typeof value !== "string") {
    return "/society";
  }

  const trimmed = value.trim();
  return trimmed.startsWith("/society") ? trimmed : "/society";
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      route?: unknown;
    };
    const now = new Date();

    await adminDb
      .collection(COLLECTIONS.SOCIETY_USER_ACTIVITY)
      .doc(data.user.uid)
      .set(
        {
          id: data.user.uid,
          user_id: data.user.uid,
          email: data.user.email || null,
          last_route: normalizeSocietyRoute(body.route),
          last_accessed_at: now,
          updated_at: now,
        },
        { merge: true }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/society/access error:", error);
    return NextResponse.json(
      { error: "Failed to track society access" },
      { status: 500 }
    );
  }
}
