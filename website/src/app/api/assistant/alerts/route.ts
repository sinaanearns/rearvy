import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import type { AssistantAlertInput } from "@/lib/assistant-alerts";
import {
  AssistantAlertStoreError,
  createAssistantAlertWithMessage,
} from "@/lib/assistant-alerts-store";

const log = createServerLogger("AssistantAlertsApi");

type AssistantAlertDoc = {
  user_id?: string;
  chat_id?: string | null;
  project_id?: string | null;
  message_id?: string | null;
  title?: string;
  summary?: string;
  message_text?: string;
  severity?: "info" | "warning" | "success";
  source?: string;
  is_read?: boolean;
  read_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

function isMissingFirestoreIndexError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; details?: unknown; message?: unknown };
  const text = `${record.details ?? ""} ${record.message ?? ""}`;

  return (
    (record.code === 9 || record.code === "FAILED_PRECONDITION") &&
    text.includes("requires an index")
  );
}

function toTimestampMillis(value: unknown) {
  if (!value) {
    return 0;
  }

  if (typeof value === "string" || typeof value === "number") {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (typeof value === "object") {
    const maybeTimestamp = value as {
      toDate?: () => Date;
      toMillis?: () => number;
    };

    if (typeof maybeTimestamp.toMillis === "function") {
      const timestamp = maybeTimestamp.toMillis();
      return Number.isFinite(timestamp) ? timestamp : 0;
    }

    if (typeof maybeTimestamp.toDate === "function") {
      const timestamp = maybeTimestamp.toDate().getTime();
      return Number.isFinite(timestamp) ? timestamp : 0;
    }
  }

  return 0;
}

async function loadAssistantAlertsByUser(params: {
  userId: string;
  unreadOnly: boolean;
  source: string | null;
  limit: number;
}) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.ASSISTANT_ALERTS)
    .where("user_id", "==", params.userId)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as AssistantAlertDoc) }))
    .filter((alert) => (params.unreadOnly ? alert.is_read === false : true))
    .filter((alert) => (params.source ? alert.source === params.source : true))
    .sort(
      (left, right) =>
        toTimestampMillis(right.created_at) - toTimestampMillis(left.created_at)
    )
    .slice(0, params.limit);
}

function normalizeSeverity(value: unknown): "info" | "warning" | "success" {
  if (value === "warning" || value === "success") {
    return value;
  }

  return "info";
}

function normalizeAlertInput(body: unknown): AssistantAlertInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  const messageText = typeof record.messageText === "string" ? record.messageText.trim() : "";

  if (!title || !summary || !messageText) {
    return null;
  }

  return {
    chatId: typeof record.chatId === "string" && record.chatId.trim() ? record.chatId.trim() : undefined,
    projectId:
      typeof record.projectId === "string"
        ? record.projectId.trim() || null
        : null,
    title,
    summary,
    messageText,
    severity: normalizeSeverity(record.severity),
    source:
      typeof record.source === "string" && record.source.trim()
        ? record.source.trim()
        : "proactive-assistant",
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";
  const source = request.nextUrl.searchParams.get("source") || null;
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.floor(limitParam), 100)) : 20;

  try {
    const shouldUseIndexedQuery = process.env.NODE_ENV !== "development";

    if (shouldUseIndexedQuery) {
      let query: FirebaseFirestore.Query = adminDb
        .collection(COLLECTIONS.ASSISTANT_ALERTS)
        .where("user_id", "==", auth.user.uid);

      if (unreadOnly) {
        query = query.where("is_read", "==", false);
      }
      if (source) {
        query = query.where("source", "==", source);
      }

      try {
        const snapshot = await query.orderBy("created_at", "desc").limit(limit).get();
        return NextResponse.json({
          ok: true,
          alerts: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        });
      } catch (queryError) {
        if (!isMissingFirestoreIndexError(queryError)) {
          throw queryError;
        }
      }
    }

    const alerts = await loadAssistantAlertsByUser({
      userId: auth.user.uid,
      unreadOnly,
      source,
      limit,
    });

    return NextResponse.json({ ok: true, alerts, usedFallback: true });
  } catch (error) {
    log.error("Failed to load assistant alerts:", error);
    return NextResponse.json(
      { ok: false, alerts: [], error: "Failed to load assistant alerts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await readJsonRecord(request);
    const alertInput = normalizeAlertInput(body);

    if (!alertInput) {
      return NextResponse.json({ error: "title, summary, and messageText are required" }, { status: 400 });
    }

    const result = await createAssistantAlertWithMessage({
      db: adminDb,
      userId: auth.user.uid,
      input: alertInput,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof AssistantAlertStoreError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    log.error("Failed to create assistant alert:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create assistant alert" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await readJsonRecord(request);
    const alertId = typeof body?.id === "string" ? body.id.trim() : "";

    if (!alertId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const alertRef = adminDb.collection(COLLECTIONS.ASSISTANT_ALERTS).doc(alertId);
    const alertSnap = await alertRef.get();

    if (!alertSnap.exists) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const alert = alertSnap.data() as AssistantAlertDoc | undefined;
    if (alert?.user_id !== auth.user.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const nextIsRead = body?.isRead !== false;
    const updates = {
      is_read: nextIsRead,
      read_at: nextIsRead ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    await alertRef.update(updates);

    return NextResponse.json({
      ok: true,
      alert: { id: alertSnap.id, ...alert, ...updates },
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    log.error("Failed to update assistant alert:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update assistant alert" },
      { status: 500 }
    );
  }
}
