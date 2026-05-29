import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  clampAssistantMessage,
  type AssistantAlertInput,
  type AssistantAlertSeverity,
} from "@/lib/assistant-alerts";

type ChatRecord = {
  user_id?: string;
  participant_ids?: string[];
  project_id?: string | null;
  title?: string | null;
};

export class AssistantAlertStoreError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AssistantAlertStoreError";
    this.status = status;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSeverity(value: unknown): AssistantAlertSeverity {
  return value === "warning" || value === "success" ? value : "info";
}

async function assertChatAccess(params: {
  db: Firestore;
  userId: string;
  chatId: string;
  projectId: string | null;
}) {
  const chatRef = params.db.collection(COLLECTIONS.CHATS).doc(params.chatId);
  const chatSnap = await chatRef.get();

  if (!chatSnap.exists) {
    return { chatRef, exists: false, chat: null as ChatRecord | null };
  }

  const chat = chatSnap.data() as ChatRecord | undefined;
  const isOwner = chat?.user_id === params.userId;
  const isParticipant =
    Array.isArray(chat?.participant_ids) &&
    chat.participant_ids.includes(params.userId);

  if (!isOwner && !isParticipant) {
    throw new AssistantAlertStoreError("Unauthorized chat", 403);
  }

  if (params.projectId && chat?.project_id !== params.projectId) {
    throw new AssistantAlertStoreError("Chat/project mismatch", 400);
  }

  return { chatRef, exists: true, chat: chat ?? null };
}

export async function createAssistantAlertRecord(params: {
  db: Firestore;
  userId: string;
  projectId?: string | null;
  chatId?: string | null;
  messageId?: string | null;
  title: string;
  summary: string;
  messageText: string;
  severity?: AssistantAlertSeverity;
  source?: string;
}) {
  const createdAt = nowIso();
  const alertRef = params.db.collection(COLLECTIONS.ASSISTANT_ALERTS).doc();
  const messageText = clampAssistantMessage(params.messageText, 220);
  const alert = {
    user_id: params.userId,
    chat_id: params.chatId ?? null,
    project_id: params.projectId ?? null,
    message_id: params.messageId ?? null,
    title: params.title,
    summary: params.summary,
    message_text: messageText,
    severity: normalizeSeverity(params.severity),
    source: params.source ?? "proactive-assistant",
    is_read: false,
    read_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };

  await alertRef.set(alert);
  return { id: alertRef.id, ...alert };
}

export async function createAssistantAlertWithMessage(params: {
  db: Firestore;
  userId: string;
  input: AssistantAlertInput;
}) {
  const createdAt = nowIso();
  const projectId = params.input.projectId ?? null;
  const chatId = params.input.chatId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const assistantText = clampAssistantMessage(params.input.messageText, 220);
  const { chatRef, exists } = await assertChatAccess({
    db: params.db,
    userId: params.userId,
    chatId,
    projectId,
  });

  const batch = params.db.batch();

  if (!exists) {
    batch.set(chatRef, {
      user_id: params.userId,
      participant_ids: [params.userId],
      project_id: projectId,
      agent_id: null,
      title: params.input.title,
      is_archived: false,
      is_pinned: false,
      is_group: false,
      created_at: createdAt,
      updated_at: createdAt,
    });
  } else {
    batch.update(chatRef, {
      title: params.input.title,
      updated_at: createdAt,
    });
  }

  const messageRef = params.db.collection(COLLECTIONS.MESSAGES).doc(messageId);
  batch.set(messageRef, {
    chat_id: chatId,
    role: "assistant",
    content: assistantText,
    parts: [{ type: "text", text: assistantText }],
    tool_invocations: null,
    metadata: {
      proactiveAlert: true,
      proactiveAlertSeverity: normalizeSeverity(params.input.severity),
      proactiveAlertSource: params.input.source ?? "proactive-assistant",
      proactiveAlertSummary: params.input.summary,
    },
    created_at: createdAt,
  });

  const alertRef = params.db.collection(COLLECTIONS.ASSISTANT_ALERTS).doc();
  const alert = {
    user_id: params.userId,
    chat_id: chatId,
    project_id: projectId,
    message_id: messageId,
    title: params.input.title,
    summary: params.input.summary,
    message_text: assistantText,
    severity: normalizeSeverity(params.input.severity),
    source: params.input.source ?? "proactive-assistant",
    is_read: false,
    read_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
  batch.set(alertRef, alert);

  await batch.commit();

  return {
    chatId,
    messageId,
    alertId: alertRef.id,
    assistantText,
  };
}
