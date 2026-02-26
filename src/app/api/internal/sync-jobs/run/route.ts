import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runPendingSyncJobs,
  type SyncProvider,
} from "@/lib/integrations/sync-jobs";

function parseProvider(raw: string | null): SyncProvider | undefined {
  if (!raw) return undefined;
  if (raw === "shopify" || raw === "youtube" || raw === "instagram") return raw;
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
  if (providedSecret !== workerSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const providerParam = searchParams.get("provider");
  const provider = parseProvider(providerParam);
  if (providerParam && !provider) {
    return NextResponse.json(
      { error: "Invalid provider. Expected 'shopify', 'youtube', or 'instagram'." },
      { status: 400 }
    );
  }

  const rawLimit = searchParams.get("limit");
  const parsedLimit = rawLimit ? Number(rawLimit) : undefined;
  const limit =
    parsedLimit && Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.floor(parsedLimit), 1), 20)
      : 5;

  const adminSupabase = createAdminClient();
  const result = await runPendingSyncJobs(adminSupabase, { provider, limit });

  return NextResponse.json({ ok: true, ...result });
}
