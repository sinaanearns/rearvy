import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { normalizeAutomationInput } from "@/lib/work/platform";

export const runtime = "nodejs";

const log = createServerLogger("WorkAutomationsApi");

function serializeTimestamp(value: unknown) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    } catch {
      return null;
    }
  }

  return value;
}

function serializeDoc(doc: { id: string; data: () => Record<string, unknown> }) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    created_at: serializeTimestamp(data.created_at),
    updated_at: serializeTimestamp(data.updated_at),
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
    log.error("Failed to list work automations:", error);
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
    const body = await readJsonRecord(request);
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
    if (isRequestBodyError(error)) {
      const message = error instanceof Error ? error.message : "Invalid request body.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.error("Failed to create work automation:", error);
    return NextResponse.json(
      { error: "Failed to create work automation." },
      { status: 500 }
    );
  }
}
