"use client";

import { Chat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import type { ChatModelTier } from "@/lib/ai/models";
import type { ChatAgentId } from "@/lib/ai/chat-agents";
import {
  normalizeChatPermissionMode,
  type ChatPermissionMode,
} from "@/lib/chat/permissions";
import { lastAssistantMessageIsCompleteWithClientToolCalls } from "@/lib/chat/auto-send";

export type ChatMessageMetadata = {
  chatId?: string;
  agentName?: string;
  traceStartedAt?: string;
  traceFinishedAt?: string;
  traceDurationMs?: number;
  [key: string]: unknown;
};

export type PersistentChatMessage = UIMessage<ChatMessageMetadata>;

type SessionRequestState = {
  chatId: string | null;
  projectId: string | null;
  aiModel: ChatModelTier;
  agentId: ChatAgentId | null;
  chatPermissionMode: ChatPermissionMode;
  thinkingMode: boolean;
  desktopPlatform: string | null;
  getHeaders: () => Promise<Record<string, string>>;
};

type ChatClientSession = {
  key: string;
  chat: Chat<PersistentChatMessage>;
  requestState: SessionRequestState;
  draftInput: string;
  lastTouchedAt: number;
};

const SESSION_TTL_MS = 30 * 60 * 1000;
const chatSessions = new Map<string, ChatClientSession>();
const DESKTOP_WORKFLOW_TOOL_NAMES = new Set(["planWorkflow", "executeWorkflow"]);

function getMessageParts(message: unknown): unknown[] {
  if (!message || typeof message !== "object") {
    return [];
  }

  const parts = (message as Record<string, unknown>).parts;
  return Array.isArray(parts) ? parts : [];
}

function getToolNameFromPart(part: unknown) {
  if (!part || typeof part !== "object") {
    return "";
  }

  const record = part as Record<string, unknown>;
  if (typeof record.toolName === "string" && record.toolName.trim()) {
    return record.toolName.trim();
  }

  if (typeof record.type === "string" && record.type.startsWith("tool-")) {
    return record.type.replace("tool-", "");
  }

  return "";
}

function lastAssistantMessageIsDesktopWorkflowHandoff(messages: unknown[]) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || typeof lastMessage !== "object") {
    return false;
  }

  const record = lastMessage as Record<string, unknown>;
  if (record.role !== "assistant") {
    return false;
  }

  return getMessageParts(lastMessage).some((part) =>
    DESKTOP_WORKFLOW_TOOL_NAMES.has(getToolNameFromPart(part))
  );
}

function extractLatestUserTextFromMessages(messages: unknown[]): string {
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

function extractLatestUserTextFromRequest(
  messages: unknown[],
  body: unknown
): string {
  const textFromMessages = extractLatestUserTextFromMessages(messages);
  if (textFromMessages) {
    return textFromMessages;
  }

  if (!body || typeof body !== "object") {
    return "";
  }

  const record = body as Record<string, unknown>;
  return typeof record.text === "string" && record.text.trim()
    ? record.text.trim()
    : "";
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
  agentId?: ChatAgentId | null;
  chatPermissionMode?: ChatPermissionMode;
  thinkingMode?: boolean;
  desktopPlatform?: string | null;
  getHeaders: () => Promise<Record<string, string>>;
  initialMessages?: PersistentChatMessage[];
}) {
  pruneExpiredSessions();

  const existing = chatSessions.get(params.key);
  if (existing) {
    existing.requestState.chatId = params.chatId ?? null;
    existing.requestState.projectId = params.projectId ?? null;
    existing.requestState.aiModel = params.aiModel;
    existing.requestState.agentId = params.agentId ?? null;
    existing.requestState.chatPermissionMode = normalizeChatPermissionMode(
      params.chatPermissionMode
    );
    existing.requestState.thinkingMode = params.thinkingMode === true;
    existing.requestState.desktopPlatform = params.desktopPlatform ?? null;
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
    agentId: params.agentId ?? null,
    chatPermissionMode: normalizeChatPermissionMode(params.chatPermissionMode),
    thinkingMode: params.thinkingMode === true,
    desktopPlatform: params.desktopPlatform ?? null,
    getHeaders: params.getHeaders,
  };

  const chat = new Chat<PersistentChatMessage>({
    messages: params.initialMessages ?? [],
    sendAutomaticallyWhen: ({ messages }) =>
      !lastAssistantMessageIsDesktopWorkflowHandoff(messages) &&
      (lastAssistantMessageIsCompleteWithClientToolCalls({ messages }) ||
        lastAssistantMessageIsCompleteWithApprovalResponses({ messages })),
    transport: new DefaultChatTransport<PersistentChatMessage>({
      api: "/api/chat",
      prepareSendMessagesRequest: async ({
        api,
        id,
        messages,
        body,
        trigger,
        messageId,
      }) => {
        const safeBody = body && typeof body === "object" ? body : {};
        const fallbackUserText = extractLatestUserTextFromRequest(
          messages,
          safeBody
        );
        const headers = await requestState.getHeaders();

        if (typeof window !== "undefined" && window.electron) {
          headers["x-rearvy-desktop"] = "1";
        }

        return {
          api,
          body: {
            id,
            messages,
            trigger,
            messageId,
            ...safeBody,
            chatId: requestState.chatId,
            projectId: requestState.projectId,
            aiModel: requestState.aiModel,
            agentId: requestState.agentId,
            chatPermissionMode: requestState.chatPermissionMode,
            thinkingMode: requestState.thinkingMode,
            desktopPlatform: requestState.desktopPlatform,
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
          headers,
        };
      },
    }),
  });

  const session: ChatClientSession = {
    key: params.key,
    chat,
    requestState,
    draftInput: "",
    lastTouchedAt: Date.now(),
  };

  chatSessions.set(params.key, session);
  return session;
}

export function getChatClientSessionDraft(key: string) {
  return chatSessions.get(key)?.draftInput ?? "";
}

export function updateChatClientSessionDraft(key: string, draftInput: string) {
  const session = chatSessions.get(key);
  if (!session) {
    return;
  }

  session.draftInput = draftInput;
  session.lastTouchedAt = Date.now();
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
    agentId?: ChatAgentId | null;
    chatPermissionMode?: ChatPermissionMode;
    thinkingMode?: boolean;
    desktopPlatform?: string | null;
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
  session.requestState.agentId = params.agentId ?? null;
  session.requestState.chatPermissionMode = normalizeChatPermissionMode(
    params.chatPermissionMode
  );
  session.requestState.thinkingMode = params.thinkingMode === true;
  session.requestState.desktopPlatform = params.desktopPlatform ?? null;
  session.requestState.getHeaders = params.getHeaders;
  session.lastTouchedAt = Date.now();
}

export function promoteChatClientSession(params: {
  fromKey: string;
  toKey: string;
  chatId: string;
  projectId?: string | null;
  aiModel: ChatModelTier;
  agentId?: ChatAgentId | null;
  chatPermissionMode?: ChatPermissionMode;
  thinkingMode?: boolean;
  desktopPlatform?: string | null;
  getHeaders: () => Promise<Record<string, string>>;
}) {
  if (params.fromKey === params.toKey) {
    updateChatClientSessionRequest(params.toKey, {
      chatId: params.chatId,
      projectId: params.projectId ?? null,
      aiModel: params.aiModel,
      agentId: params.agentId ?? null,
      chatPermissionMode: params.chatPermissionMode,
      thinkingMode: params.thinkingMode,
      desktopPlatform: params.desktopPlatform ?? null,
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
  session.requestState.agentId = params.agentId ?? null;
  session.requestState.chatPermissionMode = normalizeChatPermissionMode(
    params.chatPermissionMode
  );
  session.requestState.thinkingMode = params.thinkingMode === true;
  session.requestState.desktopPlatform = params.desktopPlatform ?? null;
  session.requestState.getHeaders = params.getHeaders;
  session.lastTouchedAt = Date.now();
  chatSessions.set(params.toKey, session);

  return session;
}
