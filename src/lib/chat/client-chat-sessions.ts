"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { ChatModelTier } from "@/lib/ai/models";

export type PersistentChatMessage = UIMessage<{ chatId?: string }>;

type SessionRequestState = {
  chatId: string | null;
  projectId: string | null;
  aiModel: ChatModelTier;
  getHeaders: () => Promise<Record<string, string>>;
};

type ChatClientSession = {
  key: string;
  chat: Chat<PersistentChatMessage>;
  requestState: SessionRequestState;
  lastTouchedAt: number;
};

const SESSION_TTL_MS = 30 * 60 * 1000;
const chatSessions = new Map<string, ChatClientSession>();

function extractLatestUserTextFromBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const record = body as Record<string, unknown>;

  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }

  const messages = Array.isArray(record.messages) ? record.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || typeof message !== "object") {
      continue;
    }

    const msgRecord = message as Record<string, unknown>;
    if (msgRecord.role !== "user") {
      continue;
    }

    if (typeof msgRecord.content === "string" && msgRecord.content.trim()) {
      return msgRecord.content.trim();
    }

    const parts = Array.isArray(msgRecord.parts) ? msgRecord.parts : [];
    const text = parts
      .filter(
        (part) =>
          part &&
          typeof part === "object" &&
          (part as Record<string, unknown>).type === "text" &&
          typeof (part as Record<string, unknown>).text === "string"
      )
      .map((part) => ((part as Record<string, unknown>).text as string).trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function pruneExpiredSessions() {
  const now = Date.now();

  for (const [key, session] of chatSessions.entries()) {
    if (session.chat.status === "submitted" || session.chat.status === "streaming") {
      continue;
    }

    if (now - session.lastTouchedAt > SESSION_TTL_MS) {
      chatSessions.delete(key);
    }
  }
}

export function getChatSessionKey(params: {
  chatId?: string | null;
  projectId?: string | null;
}) {
  const chatSegment = params.chatId?.trim() || "__new__";
  return params.projectId
    ? `project:${params.projectId}:chat:${chatSegment}`
    : `chat:${chatSegment}`;
}

export function getOrCreateChatClientSession(params: {
  key: string;
  chatId?: string | null;
  projectId?: string | null;
  aiModel: ChatModelTier;
  getHeaders: () => Promise<Record<string, string>>;
  initialMessages?: PersistentChatMessage[];
}) {
  pruneExpiredSessions();

  const existing = chatSessions.get(params.key);
  if (existing) {
    existing.requestState.chatId = params.chatId ?? null;
    existing.requestState.projectId = params.projectId ?? null;
    existing.requestState.aiModel = params.aiModel;
    existing.requestState.getHeaders = params.getHeaders;
    existing.lastTouchedAt = Date.now();

    if (
      existing.chat.messages.length === 0 &&
      params.initialMessages &&
      params.initialMessages.length > 0
    ) {
      existing.chat.messages = params.initialMessages;
    }

    return existing;
  }

  const requestState: SessionRequestState = {
    chatId: params.chatId ?? null,
    projectId: params.projectId ?? null,
    aiModel: params.aiModel,
    getHeaders: params.getHeaders,
  };

  const chat = new Chat<PersistentChatMessage>({
    messages: params.initialMessages ?? [],
    transport: new DefaultChatTransport<PersistentChatMessage>({
      api: "/api/chat",
      prepareSendMessagesRequest: async ({ api, body }) => {
        const safeBody = body && typeof body === "object" ? body : {};
        const fallbackUserText = extractLatestUserTextFromBody(safeBody);

        return {
          api,
          body: {
            ...safeBody,
            chatId: requestState.chatId,
            projectId: requestState.projectId,
            aiModel: requestState.aiModel,
            ...(fallbackUserText ? { text: fallbackUserText } : {}),
            ...(fallbackUserText
              ? {
                  message: {
                    role: "user",
                    content: fallbackUserText,
                    parts: [{ type: "text", text: fallbackUserText }],
                  },
                }
              : {}),
          },
          headers: await requestState.getHeaders(),
        };
      },
    }),
  });

  const session: ChatClientSession = {
    key: params.key,
    chat,
    requestState,
    lastTouchedAt: Date.now(),
  };

  chatSessions.set(params.key, session);
  return session;
}

export function hydrateChatClientSessionMessages(
  key: string,
  messages: PersistentChatMessage[]
) {
  if (messages.length === 0) {
    return;
  }

  const session = chatSessions.get(key);
  if (!session || session.chat.messages.length > 0) {
    return;
  }

  session.chat.messages = messages;
  session.lastTouchedAt = Date.now();
}

export function updateChatClientSessionRequest(
  key: string,
  params: {
    chatId?: string | null;
    projectId?: string | null;
    aiModel: ChatModelTier;
    getHeaders: () => Promise<Record<string, string>>;
  }
) {
  const session = chatSessions.get(key);
  if (!session) {
    return;
  }

  session.requestState.chatId = params.chatId ?? null;
  session.requestState.projectId = params.projectId ?? null;
  session.requestState.aiModel = params.aiModel;
  session.requestState.getHeaders = params.getHeaders;
  session.lastTouchedAt = Date.now();
}

export function promoteChatClientSession(params: {
  fromKey: string;
  toKey: string;
  chatId: string;
  projectId?: string | null;
  aiModel: ChatModelTier;
  getHeaders: () => Promise<Record<string, string>>;
}) {
  if (params.fromKey === params.toKey) {
    updateChatClientSessionRequest(params.toKey, {
      chatId: params.chatId,
      projectId: params.projectId ?? null,
      aiModel: params.aiModel,
      getHeaders: params.getHeaders,
    });
    return chatSessions.get(params.toKey) ?? null;
  }

  const session = chatSessions.get(params.fromKey);
  if (!session) {
    return null;
  }

  chatSessions.delete(params.fromKey);
  session.key = params.toKey;
  session.requestState.chatId = params.chatId;
  session.requestState.projectId = params.projectId ?? null;
  session.requestState.aiModel = params.aiModel;
  session.requestState.getHeaders = params.getHeaders;
  session.lastTouchedAt = Date.now();
  chatSessions.set(params.toKey, session);

  return session;
}
