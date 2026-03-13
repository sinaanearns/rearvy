import type { UIMessage } from "ai";

const STORAGE_KEY = "rearvy:pending-chat-route-handoff";
const HANDOFF_TTL_MS = 2 * 60 * 1000;

export type ChatRouteMessage = {
  id: string;
  role: "user" | "assistant";
  parts: UIMessage["parts"];
};

type PendingChatRouteHandoff = {
  chatId: string;
  projectId: string | null;
  messages: ChatRouteMessage[];
  createdAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function safeParseStoredHandoff(rawValue: string | null): PendingChatRouteHandoff | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PendingChatRouteHandoff;

    if (
      !parsed ||
      typeof parsed.chatId !== "string" ||
      !Array.isArray(parsed.messages) ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - parsed.createdAt > HANDOFF_TTL_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function readStoredHandoff(): PendingChatRouteHandoff | null {
  if (!canUseStorage()) {
    return null;
  }

  const handoff = safeParseStoredHandoff(sessionStorage.getItem(STORAGE_KEY));

  if (!handoff) {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  return handoff;
}

function matchesTarget(
  handoff: PendingChatRouteHandoff,
  chatId: string,
  projectId?: string | null
): boolean {
  if (handoff.chatId !== chatId) {
    return false;
  }

  if (projectId === undefined) {
    return true;
  }

  return handoff.projectId === (projectId ?? null);
}

function getMessageSignature(message: ChatRouteMessage): string {
  return `${message.role}:${JSON.stringify(message.parts)}`;
}

export function savePendingChatRouteHandoff(payload: {
  chatId: string;
  projectId?: string | null;
  messages: ChatRouteMessage[];
}) {
  if (!canUseStorage()) {
    return;
  }

  const handoff: PendingChatRouteHandoff = {
    chatId: payload.chatId,
    projectId: payload.projectId ?? null,
    messages: payload.messages,
    createdAt: Date.now(),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
}

export function getPendingChatRouteHandoff(
  chatId: string,
  projectId?: string | null
): ChatRouteMessage[] {
  const handoff = readStoredHandoff();

  if (!handoff || !matchesTarget(handoff, chatId, projectId)) {
    return [];
  }

  return handoff.messages;
}

export function clearPendingChatRouteHandoff(
  chatId: string,
  projectId?: string | null
) {
  if (!canUseStorage()) {
    return;
  }

  const handoff = readStoredHandoff();
  if (!handoff || !matchesTarget(handoff, chatId, projectId)) {
    return;
  }

  sessionStorage.removeItem(STORAGE_KEY);
}

export function mergeChatRouteMessages(
  persistedMessages: ChatRouteMessage[],
  handoffMessages: ChatRouteMessage[]
): ChatRouteMessage[] {
  if (handoffMessages.length === 0) {
    return persistedMessages;
  }

  const seenIds = new Set(persistedMessages.map((message) => message.id));
  const seenSignatures = new Set(
    persistedMessages.map((message) => getMessageSignature(message))
  );

  const merged = [...persistedMessages];

  for (const message of handoffMessages) {
    const signature = getMessageSignature(message);
    if (seenIds.has(message.id) || seenSignatures.has(signature)) {
      continue;
    }

    merged.push(message);
    seenIds.add(message.id);
    seenSignatures.add(signature);
  }

  return merged;
}