import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import {
  runPendingSyncJobs,
  type SyncProvider,
} from "@/lib/integrations/sync-jobs";

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseProvider(raw: string | null): SyncProvider | undefined {
  if (!raw) return undefined;
  if (
    raw === "shopify" ||
    raw === "youtube" ||
    raw === "instagram" ||
    raw === "facebook" ||
    raw === "google_analytics" ||
    raw === "razorpay"
  ) {
    return raw as SyncProvider;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const workerSecret = process.env.SYNC_WORKER_SECRET;
  if (!workerSecret) {
    return NextResponse.json(
      { error: "SYNC_WORKER_SECRET is not configured" },
      { status: 503 }
    );
  }

  const providedSecret = request.headers.get("x-sync-worker-secret");
  if (!secretsMatch(providedSecret, workerSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const providerParam = searchParams.get("provider");
  const provider = parseProvider(providerParam);
  if (providerParam && !provider) {
    return NextResponse.json(
      {
        error:
          "Invalid provider. Expected 'shopify', 'youtube', 'instagram', 'facebook', 'google_analytics', or 'razorpay'.",
      },
      { status: 400 }
    );
  }

  const rawLimit = searchParams.get("limit");
  const parsedLimit = rawLimit ? Number(rawLimit) : undefined;
  const limit =
    parsedLimit && Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.floor(parsedLimit), 1), 20)
      : 5;

  const result = await runPendingSyncJobs(adminDb, { provider, limit });

  return NextResponse.json({ ok: true, ...result });
}
