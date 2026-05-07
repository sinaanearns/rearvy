import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { listPythonSandboxRuns } from "@/lib/automation/python/registry";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const scriptId = searchParams.get("scriptId");
    const status = searchParams.get("status");

    const runs = await listPythonSandboxRuns(adminDb, auth.user.uid, {
      limit: limit ? Number(limit) : undefined,
      scriptId: scriptId || undefined,
      status:
        status === "queued" ||
        status === "awaiting_approval" ||
        status === "running" ||
        status === "completed" ||
        status === "failed" ||
        status === "canceled"
          ? status
          : status === "all"
            ? "all"
            : undefined,
    });

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Failed to list Python sandbox runs:", error);
    return NextResponse.json(
      { error: "Failed to list Python sandbox runs." },
      { status: 500 }
    );
  }
}
