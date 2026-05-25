import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { normalizeAutomationInput } from "@/lib/work/platform";

export const runtime = "nodejs";

function serializeDoc(doc: { id: string; data: () => Record<string, unknown> }) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    created_at:
      data.created_at &&
      typeof data.created_at === "object" &&
      "toDate" in data.created_at &&
      typeof data.created_at.toDate === "function"
        ? data.created_at.toDate().toISOString()
        : data.created_at,
    updated_at:
      data.updated_at &&
      typeof data.updated_at === "object" &&
      "toDate" in data.updated_at &&
      typeof data.updated_at.toDate === "function"
        ? data.updated_at.toDate().toISOString()
        : data.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS)
      .where("user_id", "==", auth.user.uid)
      .get();

    const automations = snapshot.docs
      .map(serializeDoc)
      .sort((left, right) =>
        String(right.updated_at || "").localeCompare(String(left.updated_at || ""))
      );

    return NextResponse.json({ automations });
  } catch (error) {
    console.error("Failed to list work automations:", error);
    return NextResponse.json(
      { error: "Failed to list work automations." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const now = new Date().toISOString();
    const payload = {
      user_id: auth.user.uid,
      ...normalizeAutomationInput(body || {}),
      last_run_at: null,
      created_at: now,
      updated_at: now,
    };
    const ref = adminDb.collection(COLLECTIONS.WORK_SCHEDULED_AUTOMATIONS).doc();
    await ref.set(payload);

    return NextResponse.json(
      { automation: { id: ref.id, ...payload } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create work automation:", error);
    return NextResponse.json(
      { error: "Failed to create work automation." },
      { status: 500 }
    );
  }
}
