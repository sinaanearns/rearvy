import {
  buildUserMessageSummary,
  extractIncomingMessageText,
} from "@/lib/ai/message-parts";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import {
  normalizeAskUserInput,
  normalizeAskUserOutput,
} from "@/lib/ai/tools/ask-user";
import {
  normalizeRequestBrowserConnectionInput,
  normalizeRequestBrowserConnectionOutput,
} from "@/lib/ai/tools/browser-connection";
import { createServerLogger } from "@/lib/server-logger";
import {
  hasRenderableAssistantUIParts,
  insertStepStartsAfterCompletedToolParts,
} from "@/lib/chat-message-parts";
import {
  deepStripUndefined,
  type IncomingMessage,
  isRecord,
} from "./types";

const log = createServerLogger("ChatMessageNormalization");

const ASK_USER_TOOL_NAME = "askUser";
const BROWSER_CONNECTION_TOOL_NAME = "requestBrowserConnection";

function isReplayableClientToolName(toolName: unknown) {
  return (
    toolName === ASK_USER_TOOL_NAME || toolName === BROWSER_CONNECTION_TOOL_NAME
  );
}

export function extractAssistantMessageText(content: unknown) {
  if (typeof content === "string") {
    return sanitizeAssistantText(content);
  }

  if (!Array.isArray(content)) {
    return "";
  }

  const rawContent = content
    .filter(
      (part): part is Record<string, unknown> =>
        isRecord(part) && part.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .join("");

  return sanitizeAssistantText(rawContent);
}

function hasNonEmptyAssistantContent(content: unknown): boolean {
  if (typeof content === "string") {
    return content.trim().length > 0;
  }

  if (!Array.isArray(content)) {
    return false;
  }

  return content.some((part) => {
    if (!isRecord(part)) {
      return false;
    }

    const partType = typeof part.type === "string" ? part.type : "";
    if (
      partType === "tool-call" ||
      partType === "tool-result" ||
      partType === "tool-approval-request" ||
      partType === "dynamic-tool" ||
      partType.startsWith("tool-")
    ) {
      return true;
    }

    if (typeof part.text === "string" && part.text.trim().length > 0) {
      return true;
    }

    return false;
  });
}

export function sanitizeOutboundModelMessages<
  TMessage extends { role?: unknown; content?: unknown },
>(messages: TMessage[]): TMessage[] {
  const filteredMessages = messages.filter((message, index) => {
    if (!isRecord(message)) {
      return false;
    }

    if (message.role !== "assistant") {
      if (message.role === "tool" && Array.isArray(message.content)) {
        const sanitizedToolContent = message.content.filter((part) => {
          if (!isRecord(part)) {
            return false;
          }

          if (
            "toolCallId" in part &&
            (typeof part.toolCallId !== "string" || !part.toolCallId.trim())
          ) {
            return false;
          }

          return true;
        });

        return sanitizedToolContent.length > 0;
      }

      return true;
    }

    const hasValidContent = hasNonEmptyAssistantContent(message.content);
    if (!hasValidContent) {
      log.warn("Dropped empty assistant message before provider call", {
        index,
      });
    }

    return hasValidContent;
  });

  const repairedMessages: TMessage[] = [];

  for (let index = 0; index < filteredMessages.length; index += 1) {
    const message = filteredMessages[index];
    if (!isRecord(message)) {
      continue;
    }

    if (message.role !== "tool") {
      if (message.role === "assistant" && Array.isArray(message.content)) {
        const sanitizedAssistantContent = message.content.filter((part) => {
          if (!isRecord(part) || typeof part.type !== "string") {
            return false;
          }

          if (
            (part.type === "tool-call" || part.type === "tool-result") &&
            (typeof part.toolCallId !== "string" || !part.toolCallId.trim())
          ) {
            return false;
          }

          if (
            part.type === "tool-approval-request" &&
            (typeof part.approvalId !== "string" || !part.approvalId.trim())
          ) {
            return false;
          }

          return true;
        });

        repairedMessages.push({
          ...message,
          content: sanitizedAssistantContent,
        } as TMessage);
        continue;
      }

      repairedMessages.push(message);
      continue;
    }

    const nextMessage = filteredMessages[index + 1];
    const nextRole =
      isRecord(nextMessage) && typeof nextMessage.role === "string"
        ? nextMessage.role
        : null;

    if (nextRole === "assistant") {
      repairedMessages.push(message);
      continue;
    }

    const previousMessage = repairedMessages[repairedMessages.length - 1];
    if (
      isRecord(previousMessage) &&
      previousMessage.role === "assistant" &&
      Array.isArray(previousMessage.content)
    ) {
      const strippedAssistantContent = previousMessage.content.filter((part) => {
        if (!isRecord(part) || typeof part.type !== "string") {
          return false;
        }

        if (part.type === "tool-call" || part.type === "tool-approval-request") {
          return false;
        }

        if (part.type === "text") {
          return typeof part.text === "string" && part.text.trim().length > 0;
        }

        return true;
      });

      if (strippedAssistantContent.length === 0) {
        repairedMessages.pop();
      } else {
        repairedMessages[repairedMessages.length - 1] = {
          ...previousMessage,
          content: strippedAssistantContent,
        } as TMessage;
      }
    }

    log.warn("Dropped dangling tool message before provider call", {
      index,
      nextRole,
    });
  }

  return repairedMessages;
}

function countImageTokens(value: string): number {
  const matches = value.match(/<image>/g);
  return matches ? matches.length : 0;
}

function countImageLikeParts(parts: unknown[]): number {
  let count = 0;

  for (const part of parts) {
    if (!isRecord(part) || typeof part.type !== "string") {
      continue;
    }

    if (part.type === "image") {
      count += 1;
      continue;
    }

    if (
      part.type === "file" &&
      typeof part.mediaType === "string" &&
      part.mediaType.startsWith("image/")
    ) {
      count += 1;
    }
  }

  return count;
}

function normalizeStoredToolOutput(toolName: unknown, output: unknown) {
  if (toolName === ASK_USER_TOOL_NAME) {
    try {
      return normalizeAskUserOutput(output);
    } catch {
      return {
        status: "skipped",
      };
    }
  }

  if (toolName !== BROWSER_CONNECTION_TOOL_NAME) {
    return output;
  }

  try {
    return normalizeRequestBrowserConnectionOutput(output);
  } catch {
    return {
      status: "failed",
      message: "Browser connection returned an invalid response.",
    };
  }
}

function normalizeLegacyClientToolText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 1000);
}

function normalizeStoredToolInput(toolName: unknown, input: unknown) {
  if (toolName === ASK_USER_TOOL_NAME) {
    try {
      return normalizeAskUserInput(input);
    } catch {
      const record = isRecord(input) ? input : null;
      const prompt = normalizeLegacyClientToolText(
        record?.prompt ?? record?.question ?? record?.message ?? record?.requestedAction
      );
      return prompt ? { prompt } : {};
    }
  }

  if (toolName !== BROWSER_CONNECTION_TOOL_NAME) {
    return input;
  }

  try {
    return normalizeRequestBrowserConnectionInput(input);
  } catch {
    const record = isRecord(input) ? input : null;
    const task = normalizeLegacyClientToolText(record?.requestedAction);
    return task ? { task } : {};
  }
}

function normalizeIncomingClientToolPart(part: Record<string, unknown>) {
  const toolName = getReplayToolName(part);
  if (!isReplayableClientToolName(toolName)) {
    return part;
  }

  const hasInput = part.input !== undefined || part.args !== undefined;
  const input = hasInput
    ? normalizeStoredToolInput(toolName, part.input ?? part.args ?? {})
    : undefined;
  if (part.output === undefined && part.result === undefined) {
    return deepStripUndefined({
      ...part,
      ...(hasInput ? { input } : {}),
    });
  }

  return deepStripUndefined({
    ...part,
    ...(hasInput ? { input } : {}),
    output: normalizeStoredToolOutput(
      toolName,
      part.output !== undefined ? part.output : part.result
    ),
    result: undefined,
  });
}

export function ensureModelMessageImageTokenAlignment<
  TMessage extends { role?: unknown; content?: unknown },
>(message: TMessage): TMessage {
  if (!isRecord(message) || message.role !== "user" || !Array.isArray(message.content)) {
    return message;
  }

  const contentParts = message.content as unknown[];
  const imageCount = countImageLikeParts(contentParts);
  if (imageCount === 0) {
    return message;
  }

  let tokenCount = 0;
  let firstTextIndex = -1;

  for (let index = 0; index < contentParts.length; index += 1) {
    const part = contentParts[index];
    if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string") {
      continue;
    }

    if (firstTextIndex === -1) {
      firstTextIndex = index;
    }

    tokenCount += countImageTokens(part.text);
  }

  if (tokenCount >= imageCount) {
    return message;
  }

  const missing = imageCount - tokenCount;
  const tokenPrefix = Array.from({ length: missing }, () => "<image>").join("\n");
  const nextParts = [...contentParts];

  if (firstTextIndex >= 0) {
    const existing = nextParts[firstTextIndex] as Record<string, unknown>;
    const existingText = typeof existing.text === "string" ? existing.text : "";
    nextParts[firstTextIndex] = {
      ...existing,
      text: existingText ? `${tokenPrefix}\n${existingText}` : tokenPrefix,
    };
  } else {
    nextParts.unshift({ type: "text", text: tokenPrefix });
  }

  return {
    ...message,
    content: nextParts,
  } as TMessage;
}

export function normalizeStoredParts(content: unknown): unknown[] | null {
  if (Array.isArray(content)) {
    const toolResults = new Map<
      string,
      { output: unknown; providerExecuted: boolean }
    >();
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "tool-result" &&
        "toolCallId" in part
      ) {
        const p = part as Record<string, unknown>;
        toolResults.set(String(p.toolCallId), {
          output: p.result !== undefined ? p.result : p.output ?? null,
          providerExecuted: p.providerExecuted === true,
        });
      }
    }

    const sanitizedParts = content.flatMap((part) => {
      if (!part || typeof part !== "object" || !("type" in part)) {
        return [part];
      }

      const p = part as Record<string, unknown>;

      if (
        p.type === "text" &&
        "text" in p &&
        typeof p.text === "string"
      ) {
        const sanitizedText = sanitizeAssistantText(p.text);
        if (!sanitizedText) {
          return [];
        }
        return [{ ...p, text: sanitizedText }];
      }

      if (p.type === "tool-call" && "toolCallId" in p) {
        const toolCallId = String(p.toolCallId);
        if (!toolResults.has(toolCallId)) {
          if (isReplayableClientToolName(p.toolName)) {
            const input = normalizeStoredToolInput(
              p.toolName,
              p.args || p.input || {}
            );
            return [
              {
                type: "dynamic-tool",
                toolCallId,
                toolName: p.toolName,
                input,
                state: "input-available",
              },
            ];
          }

          return [];
        }

        const toolResult = toolResults.get(toolCallId);
        const output = normalizeStoredToolOutput(
          p.toolName,
          toolResult?.output ?? null
        );
        const providerExecuted =
          p.providerExecuted === true || toolResult?.providerExecuted === true;
        return [
          {
            type: "dynamic-tool",
            toolCallId,
            toolName: p.toolName || "",
            input: normalizeStoredToolInput(p.toolName, p.args || {}),
            state: "output-available",
            output,
            ...(providerExecuted ? { providerExecuted: true } : {}),
          },
        ];
      }

      if (p.type === "tool-result") {
        return [];
      }

      if (
        (p.type === "dynamic-tool" ||
          (typeof p.type === "string" && p.type.startsWith("tool-"))) &&
        "toolCallId" in p
      ) {
        const toolName = getReplayToolName(p);
        const isReplayableClientTool = isReplayableClientToolName(toolName);
        if (isReplayableClientTool && (p.output !== undefined || p.result !== undefined)) {
          return [
            {
              ...p,
              input: normalizeStoredToolInput(toolName, p.input ?? p.args ?? {}),
              output: normalizeStoredToolOutput(
                toolName,
                p.output !== undefined ? p.output : p.result
              ),
              result: undefined,
            },
          ];
        }

        if (isReplayableClientTool) {
          return [
            {
              ...p,
              input: normalizeStoredToolInput(toolName, p.input ?? p.args ?? {}),
            },
          ];
        }

        return [p];
      }

      return [part];
    });

    if (sanitizedParts.length === 0) {
      return null;
    }

    const normalizedParts = insertStepStartsAfterCompletedToolParts(
      deepStripUndefined(sanitizedParts) as Parameters<
        typeof insertStepStartsAfterCompletedToolParts
      >[0]
    );

    return normalizedParts.length > 0
      ? (deepStripUndefined(normalizedParts) as unknown[])
      : null;
  }

  if (typeof content === "string" && content.trim()) {
    const sanitizedText = sanitizeAssistantText(content);
    return sanitizedText ? [{ type: "text", text: sanitizedText }] : null;
  }

  return null;
}

function getReplayToolName(part: unknown): string | null {
  if (!isRecord(part)) {
    return null;
  }

  if (typeof part.toolName === "string" && part.toolName.trim()) {
    return part.toolName.trim();
  }

  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.replace("tool-", "");
  }

  return null;
}

function hasReplayableClientToolParts(parts: unknown[]) {
  return parts.some((part) => {
    const toolName = getReplayToolName(part);
    return isReplayableClientToolName(toolName);
  });
}

export function sanitizeIncomingMessages(messages: unknown[]): unknown[] {
  return messages.map((message) => {
    if (!message || typeof message !== "object") {
      return message;
    }

    const record = message as Record<string, unknown>;
    const parts = Array.isArray(record.parts) ? record.parts : null;

    if (!parts) {
      return message;
    }

    return {
      ...record,
      parts: parts.flatMap((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          const sanitizedText = sanitizeAssistantText(part.text);
          if (!sanitizedText) {
            return [];
          }

          return [{ ...part, text: sanitizedText }];
        }

        if (!isRecord(part)) {
          return [part];
        }

        return [normalizeIncomingClientToolPart(part)];
      }),
    };
  });
}

export function repairAssistantMessagesForModelReplay(messages: unknown[]): unknown[] {
  return messages.flatMap((message) => {
    if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.parts)) {
      return [message];
    }

    const repairedParts = insertStepStartsAfterCompletedToolParts(
      message.parts as Parameters<typeof insertStepStartsAfterCompletedToolParts>[0]
    );
    if (
      hasRenderableAssistantUIParts(repairedParts) ||
      hasReplayableClientToolParts(repairedParts)
    ) {
      return [{ ...message, parts: repairedParts }];
    }

    const fallbackText = sanitizeAssistantText(extractIncomingMessageText(message));
    if (!fallbackText) {
      return [];
    }

    return [
      {
        ...message,
        content: fallbackText,
        parts: [{ type: "text", text: fallbackText }],
      },
    ];
  });
}

function hasMeaningfulMessageParts(parts: unknown): boolean {
  if (!Array.isArray(parts)) {
    return false;
  }

  return parts.some((part) => {
    if (!part || typeof part !== "object") {
      return false;
    }

    const record = part as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";

    if (type === "text") {
      return typeof record.text === "string" && record.text.trim().length > 0;
    }

    return true;
  });
}

function isEmptyAssistantPlaceholderMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }

  const record = message as Record<string, unknown>;
  if (record.role !== "assistant") {
    return false;
  }

  const text = extractIncomingMessageText(message);
  if (text.length > 0) {
    return false;
  }

  return !hasMeaningfulMessageParts(record.parts) && !hasMeaningfulMessageParts(record.content);
}

export function trimTrailingAssistantPlaceholders(messages: unknown[]): unknown[] {
  const trimmed = [...messages];

  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    if (!isEmptyAssistantPlaceholderMessage(last)) {
      break;
    }

    trimmed.pop();
  }

  return trimmed;
}

export function pruneAssistantPlaceholders(messages: unknown[]): unknown[] {
  return messages.filter((message) => !isEmptyAssistantPlaceholderMessage(message));
}

export function findLatestUserMessage(messages: unknown[]): IncomingMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i] as IncomingMessage;
    if (candidate?.role !== "user") {
      continue;
    }

    if (buildUserMessageSummary(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function extractFallbackUserText(payload: unknown, messages: unknown[]): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.text === "string" && record.text.trim()) {
      return record.text.trim();
    }

    if (typeof record.prompt === "string" && record.prompt.trim()) {
      return record.prompt.trim();
    }

    if (record.message) {
      const nestedMessageText = extractIncomingMessageText(record.message);
      if (nestedMessageText) {
        return nestedMessageText;
      }
    }
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = extractIncomingMessageText(messages[i]);
    if (text) {
      return text;
    }
  }

  return "";
}
