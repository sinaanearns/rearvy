import {
  buildUserMessageSummary,
  extractIncomingMessageText,
} from "@/lib/ai/message-parts";
import {
  pruneAssistantPlaceholders,
  repairAssistantMessagesForModelReplay,
  sanitizeIncomingMessages,
  trimTrailingAssistantPlaceholders,
} from "./message-normalization";
import {
  type IncomingMessage,
  isRecord,
} from "./types";

export type StoredReplayMessage = {
  id?: string;
  role?: unknown;
  content?: unknown;
  parts?: unknown;
  metadata?: unknown;
  created_at?: unknown;
};

function normalizeReplayMessages(messages: unknown[]): IncomingMessage[] {
  return trimTrailingAssistantPlaceholders(
    pruneAssistantPlaceholders(
      repairAssistantMessagesForModelReplay(
        sanitizeIncomingMessages(messages)
      )
    )
  ).filter((message): message is IncomingMessage => {
    return isRecord(message) && Boolean(message.role);
  });
}

export function normalizeIncomingReplayMessages(messages: unknown[]) {
  return normalizeReplayMessages(messages);
}

export function normalizeStoredReplayMessages(messages: StoredReplayMessage[]) {
  return normalizeReplayMessages(
    messages.flatMap((message) => {
      if (message.role !== "user" && message.role !== "assistant") {
        return [];
      }

      const parts = Array.isArray(message.parts) ? message.parts : [];
      const text =
        typeof message.content === "string" ? message.content.trim() : "";
      const fallbackParts =
        parts.length > 0
          ? parts
          : text
            ? [{ type: "text", text }]
            : [];

      return [
        {
          id: typeof message.id === "string" ? message.id : undefined,
          role: message.role,
          content: text || fallbackParts,
          parts: fallbackParts,
          metadata: isRecord(message.metadata) ? message.metadata : undefined,
        },
      ];
    })
  );
}

function getMessageId(message: IncomingMessage) {
  return typeof message.id === "string" && message.id.trim()
    ? message.id.trim()
    : null;
}

function getToolCallIds(message: IncomingMessage) {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .map((part) => {
      if (!isRecord(part)) {
        return null;
      }

      return typeof part.toolCallId === "string" && part.toolCallId.trim()
        ? part.toolCallId.trim()
        : null;
    })
    .filter((id): id is string => Boolean(id));
}

function hasToolOutput(message: IncomingMessage) {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts.some((part) => {
    if (!isRecord(part)) {
      return false;
    }

    if (part.output !== undefined || part.result !== undefined) {
      return true;
    }

    return part.state === "output-available";
  });
}

function normalizeTextForMatch(message: IncomingMessage) {
  const text =
    extractIncomingMessageText(message) || buildUserMessageSummary(message);
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function messagesMatchForDedupe(
  left: IncomingMessage,
  right: IncomingMessage
) {
  if (left.role !== right.role) {
    return false;
  }

  const leftToolIds = getToolCallIds(left);
  const rightToolIds = getToolCallIds(right);
  if (leftToolIds.length > 0 && rightToolIds.length > 0) {
    return leftToolIds.some((id) => rightToolIds.includes(id));
  }

  const leftText = normalizeTextForMatch(left);
  const rightText = normalizeTextForMatch(right);
  return Boolean(leftText && rightText && leftText === rightText);
}

function shouldPreferIncomingMessage(
  existing: IncomingMessage,
  incoming: IncomingMessage
) {
  const incomingHasToolOutput = hasToolOutput(incoming);
  const existingHasToolOutput = hasToolOutput(existing);

  if (incomingHasToolOutput) {
    return true;
  }

  if (existingHasToolOutput) {
    return false;
  }

  return true;
}

function mergePersistedToolInput(
  existing: IncomingMessage,
  incoming: IncomingMessage
) {
  const existingParts = Array.isArray(existing.parts) ? existing.parts : [];
  const incomingParts = Array.isArray(incoming.parts) ? incoming.parts : [];
  if (existingParts.length === 0 || incomingParts.length === 0) {
    return incoming;
  }

  const inputByToolCallId = new Map<string, unknown>();
  for (const part of existingParts) {
    if (!isRecord(part) || typeof part.toolCallId !== "string") {
      continue;
    }

    const input = part.input ?? part.args;
    if (input !== undefined && input !== null) {
      inputByToolCallId.set(part.toolCallId, input);
    }
  }

  if (inputByToolCallId.size === 0) {
    return incoming;
  }

  let changed = false;
  const mergedParts = incomingParts.map((part) => {
    if (!isRecord(part) || typeof part.toolCallId !== "string") {
      return part;
    }

    if (part.input !== undefined || part.args !== undefined) {
      return part;
    }

    const persistedInput = inputByToolCallId.get(part.toolCallId);
    if (persistedInput === undefined || persistedInput === null) {
      return part;
    }

    changed = true;
    return {
      ...part,
      input: persistedInput,
    };
  });

  return changed
    ? {
        ...incoming,
        parts: mergedParts,
      }
    : incoming;
}

export function mergeReplayMessages(params: {
  persistedMessages: StoredReplayMessage[];
  incomingMessages: unknown[];
}) {
  const merged = normalizeStoredReplayMessages(params.persistedMessages);
  const incomingMessages = normalizeIncomingReplayMessages(
    params.incomingMessages
  );
  const idIndex = new Map<string, number>();

  merged.forEach((message, index) => {
    const id = getMessageId(message);
    if (id) {
      idIndex.set(id, index);
    }
  });

  for (const incoming of incomingMessages) {
    const incomingId = getMessageId(incoming);
    const existingIndex =
      incomingId !== null ? idIndex.get(incomingId) : undefined;

    if (typeof existingIndex === "number") {
      if (shouldPreferIncomingMessage(merged[existingIndex], incoming)) {
        merged[existingIndex] = mergePersistedToolInput(
          merged[existingIndex],
          incoming
        );
      }
      continue;
    }

    let matchingIndex = -1;
    for (let index = merged.length - 1; index >= 0; index -= 1) {
      if (messagesMatchForDedupe(merged[index], incoming)) {
        matchingIndex = index;
        break;
      }
    }

    if (matchingIndex >= 0) {
      if (shouldPreferIncomingMessage(merged[matchingIndex], incoming)) {
        merged[matchingIndex] = mergePersistedToolInput(
          merged[matchingIndex],
          incoming
        );
      }

      if (incomingId) {
        idIndex.set(incomingId, matchingIndex);
      }
      continue;
    }

    merged.push(incoming);
    if (incomingId) {
      idIndex.set(incomingId, merged.length - 1);
    }
  }

  return normalizeReplayMessages(merged);
}
