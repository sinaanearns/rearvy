import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { normalizeAutomationInput } from "@/lib/work/platform";

export const runtime = "nodejs";

const log = createServerLogger("WorkAutomationApi");

async function getOwnedAutomation(id: string, userId: string) {
  const ref = adminDb.collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data || data.user_id !== userId) {
    return null;
  }
  return { ref, data };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const owned = await getOwnedAutomation(id, auth.user.uid);
  if (!owned) {
    return NextResponse.json({ error: "Automation not found." }, { status: 404 });
  }

  try {
    const body = await readJsonRecord(request);
    const patch = normalizeAutomationInput(body || {}, owned.data);
    await owned.ref.set(patch, { merge: true });
    return NextResponse.json({ automation: { id, ...owned.data, ...patch } });
  } catch (error) {
    if (isRequestBodyError(error)) {
      const message = error instanceof Error ? error.message : "Invalid request body.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.error("Failed to update work automation:", error);
    return NextResponse.json(
      { error: "Failed to update work automation." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const owned = await getOwnedAutomation(id, auth.user.uid);
  if (!owned) {
    return NextResponse.json({ error: "Automation not found." }, { status: 404 });
  }

  await owned.ref.delete();
  return NextResponse.json({ ok: true });
}
