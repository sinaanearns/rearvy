import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { runWhisperNetScanForUser } from "@/lib/whispernet/service";

export async function POST(request: NextRequest) {
  const workerSecret = process.env.SYNC_WORKER_SECRET;
  if (!workerSecret) {
    return NextResponse.json(
      { error: "SYNC_WORKER_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (request.headers.get("x-sync-worker-secret") !== workerSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const explicitUserId = searchParams.get("userId");
    const rawLimit = Number(searchParams.get("limit") || 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 50)) : 10;

    let userIds: string[] = [];

    if (explicitUserId) {
      userIds = [explicitUserId];
    } else {
      const watchersSnapshot = await adminDb
        .collection(COLLECTIONS.WHISPERNET_WATCHERS)
        .get();

      userIds = Array.from(
        new Set(
          watchersSnapshot.docs
            .map((doc) => doc.data().user_id)
            .filter((userId): userId is string => typeof userId === "string")
        )
      ).slice(0, limit);
    }

    const results = [];
    for (const userId of userIds) {
      try {
        const result = await runWhisperNetScanForUser(adminDb, userId, "internal");
        results.push({ userId, ok: true, result });
      } catch (error) {
        results.push({
          userId,
          ok: false,
          error: error instanceof Error ? error.message : "Scan failed.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Failed to run internal WhisperNet worker:", error);
    return NextResponse.json(
      { error: "Failed to run WhisperNet worker." },
      { status: 500 }
    );
  }
}
