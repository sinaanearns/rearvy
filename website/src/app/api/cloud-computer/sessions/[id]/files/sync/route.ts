import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getResultStatusCode(result: unknown, fallback: number) {
  if (!result || typeof result !== "object" || !("code" in result)) {
    return fallback;
  }

  return typeof result.code === "number" ? result.code : fallback;
}

function isErrorResult(result: unknown): result is { error: string; code?: unknown } {
  return result !== null &&
    typeof result === "object" &&
    "error" in result &&
    typeof result.error === "string";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { syncCloudComputerDownloads } = await import("@/lib/cloud-computer/service");
  const result = await syncCloudComputerDownloads({
    userId: auth.user.uid,
    sessionId: id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code || 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    session: result.session,
    syncedFiles: result.syncedFiles,
    message: result.message,
  });
}
