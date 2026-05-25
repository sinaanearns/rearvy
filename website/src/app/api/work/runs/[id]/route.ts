import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { updateWorkRunApproval } from "@/lib/work/runtime";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Unsupported Work run action." },
      { status: 400 }
    );
  }

  const run = await updateWorkRunApproval(adminDb, {
    userId: auth.user.uid,
    runId: id,
    action,
    actorUserId: auth.user.uid,
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, run });
}

