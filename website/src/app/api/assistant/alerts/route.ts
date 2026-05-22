import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  clampAssistantMessage,
  type AssistantAlertInput,
} from "@/lib/assistant-alerts";

type AssistantAlertDoc = {
  user_id?: string;
  chat_id?: string;
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

type ChatRecord = {
  user_id?: string;
  participant_ids?: string[];
  project_id?: string | null;
  title?: string | null;
};

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

async function createChatWithAssistantMessage(params: {
  userId: string;
  projectId: string | null;
  title: string;
  summary: string;
  messageText: string;
  severity: "info" | "warning" | "success";
  source: string;
  chatId?: string;
}) {
  const nowIso = new Date().toISOString();
  const chatId = params.chatId ?? crypto.randomUUID();
  const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
  const messageId = crypto.randomUUID();
  const alertId = crypto.randomUUID();
  const assistantText = clampAssistantMessage(params.messageText, 220);

  const chatSnap = params.chatId ? await chatRef.get() : null;
  if (chatSnap && chatSnap.exists) {
    const chat = chatSnap.data() as ChatRecord | undefined;
    const isOwner = chat?.user_id === params.userId;
    const isParticipant =
      Array.isArray(chat?.participant_ids) && chat.participant_ids.includes(params.userId);

    if (!isOwner && !isParticipant) {
      return { error: NextResponse.json({ error: "Unauthorized chat" }, { status: 403 }) };
    }

    if (params.projectId && chat?.project_id !== params.projectId) {
      return { error: NextResponse.json({ error: "Chat/project mismatch" }, { status: 400 }) };
    }
  }

  const batch = adminDb.batch();

  if (!chatSnap || !chatSnap.exists) {
    batch.set(chatRef, {
      user_id: params.userId,
      participant_ids: [params.userId],
      project_id: params.projectId,
      agent_id: null,
      title: params.title,
      is_archived: false,
      is_pinned: false,
      is_group: false,
      created_at: nowIso,
      updated_at: nowIso,
    });
  } else {
    batch.update(chatRef, {
      title: params.title,
      updated_at: nowIso,
    });
  }

  const messageRef = adminDb.collection(COLLECTIONS.MESSAGES).doc(messageId);
  batch.set(messageRef, {
    chat_id: chatId,
    role: "assistant",
    content: assistantText,
    parts: [{ type: "text", text: assistantText }],
    tool_invocations: null,
    metadata: {
      proactiveAlert: true,
      proactiveAlertSeverity: params.severity,
      proactiveAlertSource: params.source,
      proactiveAlertSummary: params.summary,
    },
    created_at: nowIso,
  });

  const alertRef = adminDb.collection(COLLECTIONS.ASSISTANT_ALERTS).doc(alertId);
  batch.set(alertRef, {
    user_id: params.userId,
    chat_id: chatId,
    project_id: params.projectId,
    message_id: messageId,
    title: params.title,
    summary: params.summary,
    message_text: assistantText,
    severity: params.severity,
    source: params.source,
    is_read: false,
    read_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  });

  await batch.commit();

  return {
    chatId,
    messageId,
    alertId,
    assistantText,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "true";
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(Math.floor(limitParam), 100)) : 20;

  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection(COLLECTIONS.ASSISTANT_ALERTS)
      .where("user_id", "==", auth.user.uid);

    if (unreadOnly) {
      query = query.where("is_read", "==", false);
    }

    try {
      const snapshot = await query.orderBy("created_at", "desc").limit(limit).get();
      return NextResponse.json({
        ok: true,
        alerts: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      });
    } catch (queryError) {
      console.warn("Assistant alerts query failed, using fallback scan:", queryError);

      const fallbackSnapshot = await adminDb
        .collection(COLLECTIONS.ASSISTANT_ALERTS)
        .where("user_id", "==", auth.user.uid)
        .get();

      const alerts = fallbackSnapshot.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as AssistantAlertDoc) }))
        .filter((alert) => (unreadOnly ? alert.is_read === false : true))
        .sort((left, right) => {
          const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
          const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
          return rightTime - leftTime;
        })
        .slice(0, limit);

      return NextResponse.json({ ok: true, alerts, usedFallback: true });
    }
  } catch (error) {
    console.error("Failed to load assistant alerts:", error);
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
    const body = await request.json();
    const alertInput = normalizeAlertInput(body);

    if (!alertInput) {
      return NextResponse.json({ error: "title, summary, and messageText are required" }, { status: 400 });
    }

    const result = await createChatWithAssistantMessage({
      userId: auth.user.uid,
      projectId: alertInput.projectId ?? null,
      title: alertInput.title,
      summary: alertInput.summary,
      messageText: alertInput.messageText,
      severity: alertInput.severity ?? "info",
      source: alertInput.source ?? "proactive-assistant",
      chatId: alertInput.chatId,
    });

    if ("error" in result) {
      return result.error;
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Failed to create assistant alert:", error);
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
    const body = await request.json();
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
    console.error("Failed to update assistant alert:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update assistant alert" },
      { status: 500 }
    );
  }
}