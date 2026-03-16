import type { UIMessage } from "ai";

const STORAGE_KEY = "rearvy:pending-chat-route-handoff";
const HANDOFF_TTL_MS = 2 * 60 * 1000;

export type ChatRouteMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  // Normalize parts before stringifying to ensure comparison is stable
  const normalizedParts = normalizeLoadedParts(message.parts);
  
  // Also include a normalized version of the content string if parts are somehow different
  // but content remains the same (safety fallback)
  const normalizedContent = (message.content || "").trim();
  
  return `${message.role}:${normalizedContent}:${JSON.stringify(normalizedParts)}`;
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

/**
 * Convert stored parts from Firestore to UIMessage-compatible format.
 * Handles old messages stored with "tool-call"/"tool-result" types
 * by converting them to the dynamic-tool format the UI expects.
 */
export function normalizeLoadedParts(
  parts: UIMessage["parts"]
): UIMessage["parts"] {
  // Collect tool results for pairing with tool calls
  const toolResults = new Map<string, unknown>();
  for (const part of parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as Record<string, unknown>).type === "tool-result" &&
      "toolCallId" in part
    ) {
      const p = part as Record<string, unknown>;
      toolResults.set(
        String(p.toolCallId),
        p.result !== undefined ? p.result : (p.output ?? null)
      );
    }
  }

  return parts.flatMap((part) => {
    if (!part || typeof part !== "object" || !("type" in part)) {
      return [];
    }

    const p = part as Record<string, unknown>;

    // Text parts pass through
    if (p.type === "text") {
      return [part];
    }

    // Convert old tool-call format to dynamic-tool format (must be checked BEFORE startsWith("tool-"))
    if (p.type === "tool-call" && "toolCallId" in p) {
      const toolCallId = String(p.toolCallId);
      const output = toolResults.get(toolCallId) ?? null;
      return [
        {
          type: "dynamic-tool",
          toolCallId,
          toolName: String(p.toolName || ""),
          input: p.args || {},
          state: "output-available",
          output,
        } as unknown as UIMessage["parts"][number],
      ];
    }

    // Skip standalone tool-result (merged into tool-call above)
    if (p.type === "tool-result") {
      return [];
    }

    // Already in UIMessage tool format (tool-xxx or dynamic-tool)
    if (
      typeof p.type === "string" &&
      (p.type.startsWith("tool-") || p.type === "dynamic-tool")
    ) {
      return [part];
    }

    // step-start and other known types
    if (p.type === "step-start") {
      return [part];
    }

    return [];
  });
}