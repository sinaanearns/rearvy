import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  convertToModelMessages,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { buildFreeTierWebResearchContext } from "@/lib/ai/free-tier-web-research";
import {
  buildSystemPrompt,
  loadSystemPromptContext,
} from "@/lib/ai/system-prompt";
import { getChatAgentById } from "@/lib/ai/chat-agents";
import { createToolRegistry } from "@/lib/ai/tools";
import {
  resolveChatApiKeySource,
  resolveChatModelOption,
  resolveChatModelTier,
  resolveChatProviderModel,
} from "@/lib/ai/models";
// mempalace functions are imported dynamically inside the POST handler to avoid unintentional project-wide NFT tracing
// import { buildMempalaceRecallContext, captureMempalaceConversation } from "@/lib/ai/mempalace";
import {
  buildStoredUserMessageParts,
  buildUserMessageSummary,
  extractIncomingMessageText,
  messageHasImageParts,
  normalizeIncomingMessagesForModel,
} from "@/lib/ai/message-parts";
import { detectGmailComposeIntent } from "@/lib/ai/gmail-compose-intent";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import { detectTradingPairIntent } from "@/lib/ai/trading-intent";
import { DEFAULT_PLAN } from "@/lib/plans";
import { CHAT_CONFIG } from "@/lib/utils/constants";
import {
  hasRenderableAssistantUIParts,
  insertStepStartsAfterCompletedToolParts,
} from "@/lib/chat-message-parts";
import {
  extractAutoMemoryCandidate,
  saveMemoryRecord,
} from "@/lib/memory-store";
import { detectAndProcessCommand } from "@/lib/ai/smart-commands";
import { formatTradingPrice } from "@/lib/trading/price-format";
import { getReadableErrorMessage } from "@/lib/error-message";
import type { TradingOpinion } from "@/types/trading";
import type { NextRequest } from "next/server";

type IncomingMessage = {
  id?: string;
  role?: unknown;
  content?: unknown;
  parts?: unknown;
};

type ToolResultPart = {
  type?: string;
  toolCallId?: unknown;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  output?: unknown;
};

type StoredChat = {
  user_id?: string;
  participant_ids?: string[];
  project_id?: string | null;
  agent_id?: string | null;
  title?: string | null;
};

type StoredProject = {
  user_id?: string;
  name?: string | null;
  description?: string | null;
};

type AssistantMessageRecord = {
  id?: string;
  role?: string;
  content?: unknown;
};

type MemoryToolTrace = {
  tools: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
};

function deepStripUndefined(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepStripUndefined);
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        result[key] = deepStripUndefined(value);
      }
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractAssistantMessageText(content: unknown) {
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
    if (partType === "tool-call" || partType === "tool-result") {
      return true;
    }

    if (typeof part.text === "string" && part.text.trim().length > 0) {
      return true;
    }

    return false;
  });
}



function isTradingOpinionOutput(output: unknown): output is TradingOpinion {
  if (!isRecord(output)) {
    return false;
  }

  return (
    typeof output.action === "string" &&
    ["Buy", "Sell", "Hold"].includes(output.action) &&
    typeof output.confidence === "number" &&
    typeof output.reason === "string" &&
    typeof output.symbol === "string" &&
    typeof output.timeframe === "string" &&
    typeof output.riskNotes === "string" &&
    typeof output.fetchedAt === "number"
  );
}

function buildTradingOpinionSummary(output: unknown) {
  if (!isTradingOpinionOutput(output)) {
    return "I checked the trading setup, but the result was not in a displayable format. Please try again.";
  }

  const confidence =
    output.action === "Hold" || output.confidence <= 0
      ? "no actionable signal"
      : `${Math.round(output.confidence * 100)}% signal agreement`;
  const heading = `${output.symbol} ${output.timeframe}: ${output.action}`;

  if (output.action === "Hold") {
    return `${heading}. There is no clean trade right now (${confidence}). ${output.reason}`;
  }

  const levels = [
    typeof output.entry === "number"
      ? `entry ${formatTradingPrice(output.entry, output.symbol)}`
      : null,
    typeof output.stopLoss === "number"
      ? `stop ${formatTradingPrice(output.stopLoss, output.symbol)}`
      : null,
    typeof output.takeProfit === "number"
      ? `target ${formatTradingPrice(output.takeProfit, output.symbol)}`
      : null,
  ].filter(Boolean);

  return `${heading} with ${confidence}.${levels.length ? ` Levels: ${levels.join(", ")}.` : ""} ${output.reason} Risk: ${output.riskNotes}`;
}

function isVerifiedTraderSignalRequest(userText: string | null | undefined) {
  if (!userText) {
    return false;
  }

  return (
    /^\/signals\b/i.test(userText.trim()) ||
    /\b(verified trader|professional trader|trader signals?|copy signals?|hedge funds?|who is buying|who is selling)\b/i.test(
      userText
    )
  );
}

function sanitizeOutboundModelMessages<
  TMessage extends { role?: unknown; content?: unknown },
>(messages: TMessage[]): TMessage[] {
  const filteredMessages = messages.filter((message, index) => {
    if (!isRecord(message)) {
      return false;
    }

    if (message.role !== "assistant") {
      return true;
    }

    const hasValidContent = hasNonEmptyAssistantContent(message.content);
    if (!hasValidContent) {
      console.warn("Dropped empty assistant message before provider call", {
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

    console.warn("Dropped dangling tool message before provider call", {
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

function ensureModelMessageImageTokenAlignment<
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

function compactMemoryToolResult(result: unknown): unknown {
  if (
    result === null ||
    result === undefined ||
    typeof result === "number" ||
    typeof result === "boolean"
  ) {
    return result;
  }

  if (typeof result === "string") {
    return result.length > 2000 ? `${result.slice(0, 1997)}...` : result;
  }

  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > 2000) {
      return `${serialized.slice(0, 1997)}...`;
    }

    return JSON.parse(serialized) as unknown;
  } catch {
    const fallback = String(result);
    return fallback.length > 2000 ? `${fallback.slice(0, 1997)}...` : fallback;
  }
}

function buildMemoryToolTrace(
  assistantMessages: AssistantMessageRecord[]
): MemoryToolTrace | undefined {
  const toolResults = new Map<string, unknown>();
  const toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }> = [];

  for (const message of assistantMessages) {
    if (!Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (!isRecord(part)) {
        continue;
      }

      if (part.type === "tool-result" && "toolCallId" in part) {
        const toolCallId = String(part.toolCallId);
        toolResults.set(
          toolCallId,
          part.result !== undefined ? part.result : part.output ?? null
        );
        continue;
      }

      if (part.type === "tool-call" && "toolCallId" in part) {
        toolCalls.push({
          toolCallId: String(part.toolCallId),
          toolName: typeof part.toolName === "string" ? part.toolName : "unknown",
          args: isRecord(part.args) ? part.args : {},
        });
      }
    }
  }

  if (toolCalls.length === 0) {
    return undefined;
  }

  return {
    tools: toolCalls.map((toolCall) => ({
      name: toolCall.toolName,
      args: toolCall.args,
      result: compactMemoryToolResult(
        toolResults.get(toolCall.toolCallId) ?? null
      ),
    })),
  };
}

function normalizeStoredParts(content: unknown): unknown[] | null {
  if (Array.isArray(content)) {
    // Collect tool-call and tool-result parts so we can pair them
    const toolResults = new Map<string, unknown>();
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "tool-result" &&
        "toolCallId" in part
      ) {
        const p = part as Record<string, unknown>;
        toolResults.set(
          String(p.toolCallId),
          p.result !== undefined ? p.result : p.output ?? null
        );
      }
    }

    const sanitizedParts = content.flatMap((part) => {
      if (!part || typeof part !== "object" || !("type" in part)) {
        return [part];
      }

      const p = part as Record<string, unknown>;

      // Sanitize text parts
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

      // Convert tool-call parts to UIMessage-compatible dynamic-tool format
      if (p.type === "tool-call" && "toolCallId" in p) {
        const toolCallId = String(p.toolCallId);
        if (!toolResults.has(toolCallId)) {
          return [];
        }

        const output = toolResults.get(toolCallId) ?? null;
        return [
          {
            type: "dynamic-tool",
            toolCallId,
            toolName: p.toolName || "",
            input: p.args || {},
            state: "output-available",
            output,
          },
        ];
      }

      // Skip standalone tool-result parts (already merged into tool-invocation above)
      if (p.type === "tool-result") {
        return [];
      }

      return [part];
    });

    if (sanitizedParts.length === 0) {
      return null;
    }

    const normalizedParts = insertStepStartsAfterCompletedToolParts(
      deepStripUndefined(sanitizedParts)
    );

    return normalizedParts.length > 0 ? deepStripUndefined(normalizedParts) : null;
  }

  if (typeof content === "string" && content.trim()) {
    const sanitizedText = sanitizeAssistantText(content);
    return sanitizedText ? [{ type: "text", text: sanitizedText }] : null;
  }

  return null;
}

function sanitizeIncomingMessages(messages: unknown[]): unknown[] {
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

        return [part];
      }),
    };
  });
}

function repairAssistantMessagesForModelReplay(messages: unknown[]): unknown[] {
  return messages.flatMap((message) => {
    if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.parts)) {
      return [message];
    }

    const repairedParts = insertStepStartsAfterCompletedToolParts(
      message.parts as Parameters<typeof insertStepStartsAfterCompletedToolParts>[0]
    );
    if (hasRenderableAssistantUIParts(repairedParts)) {
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

function trimTrailingAssistantPlaceholders(messages: unknown[]): unknown[] {
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

function pruneAssistantPlaceholders(messages: unknown[]): unknown[] {
  return messages.filter((message) => !isEmptyAssistantPlaceholderMessage(message));
}

function findLatestUserMessage(messages: unknown[]): IncomingMessage | null {
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

function extractFallbackUserText(payload: unknown, messages: unknown[]): string {
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

async function maybeAutoSaveImportantMemory(params: {
  userId: string;
  userText: string;
  projectId?: string | null;
}) {
  const candidate = extractAutoMemoryCandidate(params.userText);
  if (!candidate) {
    return null;
  }

  try {
    return await saveMemoryRecord({
      adminDb,
      userId: params.userId,
      content: candidate.content,
      memoryType: candidate.memoryType,
      importance: candidate.importance,
      tags: candidate.tags,
      projectId: params.projectId,
    });
  } catch (error) {
    console.warn("Auto-memory save skipped after failure:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";
  const isDesktopApp = userAgent.toLowerCase().includes("electron");

  try {

  const [payload, auth] = await Promise.all([req.json(), requireAuth(req)]);
  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  const messages = trimTrailingAssistantPlaceholders(
    pruneAssistantPlaceholders(
      repairAssistantMessagesForModelReplay(
        sanitizeIncomingMessages(rawMessages)
      )
    )
  );
  const messagesForModel = normalizeIncomingMessagesForModel(messages);
  const chatId = typeof payload?.chatId === "string" ? payload.chatId : null;
  const projectId =
    typeof payload?.projectId === "string" ? payload.projectId : null;
  const hasExplicitAgentSelection =
    payload &&
    typeof payload === "object" &&
    Object.prototype.hasOwnProperty.call(payload, "agentId");
  const rawAgentId =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).agentId
      : undefined;

  if (typeof rawAgentId === "string" && rawAgentId.trim() && !getChatAgentById(rawAgentId.trim())) {
    return new Response(
      JSON.stringify({ error: "Invalid agentId." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const requestedAgentId =
    typeof rawAgentId === "string" && rawAgentId.trim()
      ? rawAgentId.trim()
      : null;

  if (auth.error) {
    return auth.error;
  }
  const user = auth.user!;
  const userPlan = DEFAULT_PLAN;
  const aiModel = resolveChatModelTier(payload?.aiModel, userPlan);
  if (!aiModel) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid aiModel. Please retry with a supported model without auto-switching.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const lastMessage =
    messages.length > 0
      ? (messages[messages.length - 1] as IncomingMessage)
      : null;
  const isLastMessageUser = lastMessage?.role === "user";
  const userMessageSummary = lastMessage
    ? buildUserMessageSummary(lastMessage)
    : "";
  const latestUserMessage = findLatestUserMessage(messages);
  let effectiveUserMessage: IncomingMessage | null =
    isLastMessageUser && userMessageSummary ? lastMessage : latestUserMessage;
  if (!effectiveUserMessage) {
    const fallbackUserText = extractFallbackUserText(payload, messages);
    if (fallbackUserText) {
      effectiveUserMessage = {
        role: "user",
        content: fallbackUserText,
        parts: [{ type: "text", text: fallbackUserText }],
      };
    }
  }

  const effectiveUserText =
    effectiveUserMessage ? extractIncomingMessageText(effectiveUserMessage) : "";
  const effectiveUserMessageSummary = effectiveUserMessage
    ? buildUserMessageSummary(effectiveUserMessage)
    : "";
  let resolvedChatId = chatId;
  let resolvedProjectId = projectId;
  let resolvedProject: StoredProject | null = null;
  let resolvedAgentId: string | null = requestedAgentId;

  if (resolvedChatId) {
    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
    const chatSnap = await chatRef.get();
    const chat = chatSnap.data() as StoredChat | undefined;

    const isOwner = chat?.user_id === user.uid;
    const isParticipant =
      Array.isArray(chat?.participant_ids) &&
      chat.participant_ids.includes(user.uid);

    if (!chat || (!isOwner && !isParticipant)) {
      return new Response("Chat not found", { status: 404 });
    }

    if (resolvedProjectId && chat.project_id !== resolvedProjectId) {
      return new Response("Chat/project mismatch", { status: 400 });
    }

    if (!resolvedProjectId && typeof chat.project_id === "string") {
      resolvedProjectId = chat.project_id;
    }

    if (!hasExplicitAgentSelection) {
      resolvedAgentId =
        typeof chat.agent_id === "string" && chat.agent_id.trim()
          ? chat.agent_id
          : null;
    } else if ((chat.agent_id ?? null) !== resolvedAgentId) {
      void chatRef.update({
        agent_id: resolvedAgentId,
        updated_at: new Date().toISOString(),
      }).catch((error) => {
        console.error("Failed to update chat agent:", error);
      });
    }
  } else {
    if (!effectiveUserMessage || !effectiveUserMessageSummary) {
      return new Response("Missing user message", { status: 400 });
    }

    if (resolvedProjectId) {
      const projectRef = adminDb
        .collection(COLLECTIONS.PROJECTS)
        .doc(resolvedProjectId);
      const projectSnap = await projectRef.get();
      const project = projectSnap.data() as StoredProject | undefined;

      if (!project || project.user_id !== user.uid) {
        return new Response("Project not found", { status: 404 });
      }

      resolvedProject = project;
    }

    try {
      const createdChatRef = await adminDb
        .collection(COLLECTIONS.CHATS)
        .add({
          user_id: user.uid,
          participant_ids: [user.uid],
          project_id: resolvedProjectId,
          agent_id: resolvedAgentId,
          title: null,
          is_archived: false,
          is_pinned: false,
          is_group: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      resolvedChatId = createdChatRef.id;
    } catch (error) {
      console.error("Failed to create chat:", error);
      return new Response("Failed to create chat", { status: 500 });
    }
  }

  if (!resolvedProject && resolvedProjectId) {
    const projectRef = adminDb
      .collection(COLLECTIONS.PROJECTS)
      .doc(resolvedProjectId);
    const projectSnap = await projectRef.get();
    const project = projectSnap.data() as StoredProject | undefined;

    if (!project || project.user_id !== user.uid) {
      return new Response("Project not found", { status: 404 });
    }

    resolvedProject = project;
  }

  const promptContextPromise = loadSystemPromptContext({
    userId: user.uid,
    projectId: resolvedProjectId,
    adminDb,
    project: resolvedProject,
    responseMode: "deep",
  });

  const shouldPersistIncomingUserMessage = Boolean(
    (isLastMessageUser && userMessageSummary) ||
      (!chatId && effectiveUserMessage && effectiveUserMessageSummary)
  );

  if (shouldPersistIncomingUserMessage && effectiveUserMessage && effectiveUserMessageSummary) {
    if (!resolvedChatId) {
      return new Response("Chat not ready", { status: 500 });
    }

    try {
      const messageId = effectiveUserMessage.id;
      const nowIso = new Date().toISOString();
      const storedParts =
        buildStoredUserMessageParts(effectiveUserMessage);
      const messagePayload = {
        chat_id: resolvedChatId,
        role: "user",
        content: effectiveUserMessageSummary || null,
        parts:
          storedParts ??
          (effectiveUserText
            ? [{ type: "text", text: effectiveUserText }]
            : null),
        tool_invocations: null,
        metadata: { source: "chat_request" },
        created_at: nowIso,
      };
      const batch = adminDb.batch();
      const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
      const messageRef = messageId
        ? adminDb.collection(COLLECTIONS.MESSAGES).doc(messageId)
        : adminDb.collection(COLLECTIONS.MESSAGES).doc();

      batch.set(messageRef, messagePayload);
      batch.update(chatRef, { updated_at: nowIso });
      await batch.commit();
    } catch (error) {
      console.error("Failed to persist user message:", error);
      return new Response("Failed to save message", { status: 500 });
    }
  }

  if (effectiveUserText) {
    void maybeAutoSaveImportantMemory({
      userId: user.uid,
      userText: effectiveUserText,
      projectId: resolvedProjectId,
    });
  }

  const commandResult = detectAndProcessCommand(effectiveUserText);
  let finalMessagesForModel = [...messagesForModel];

  const hasUserMessageInModelInput = finalMessagesForModel.some((message) => {
    if (!isRecord(message)) {
      return false;
    }

    return message.role === "user" && extractIncomingMessageText(message).length > 0;
  });

  // Some first-turn requests can arrive with fallback `text` in payload while
  // `messages` is empty. Ensure the model always receives the effective user turn.
  if (!hasUserMessageInModelInput && effectiveUserMessage) {
    finalMessagesForModel.push(effectiveUserMessage);
  }
  
  if (commandResult.hasCommand && effectiveUserText && finalMessagesForModel.length > 0) {
    const latestUserIndex = [...finalMessagesForModel]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => {
        return (
          typeof message === "object" &&
          message !== null &&
          "role" in message &&
          (message as Record<string, unknown>).role === "user"
        );
      })?.index;

    if (typeof latestUserIndex === "number") {
      const latestUserMessageForModel = finalMessagesForModel[latestUserIndex];
      if (
        typeof latestUserMessageForModel === "object" &&
        latestUserMessageForModel !== null
      ) {
        const updatedUserMsg = {
          ...latestUserMessageForModel,
        } as Record<string, any>;
        updatedUserMsg.content = `[INSTRUCTION: ${commandResult.instruction}]\n\nUser request: ${effectiveUserText}`;

        finalMessagesForModel = finalMessagesForModel.map((message, index) =>
          index === latestUserIndex ? updatedUserMsg : message
        );
      }
    }
  }

  const modelMessagesPromise = convertToModelMessages(
    finalMessagesForModel as Parameters<typeof convertToModelMessages>[0]
  );
  const mempalaceRecallPromise =
    resolvedChatId && effectiveUserText
      ? import("@/lib/ai/mempalace").then(({ buildMempalaceRecallContext }) =>
          buildMempalaceRecallContext({
            userId: user.uid,
            chatId: resolvedChatId,
            projectId: resolvedProjectId,
            agentId: resolvedAgentId,
            userText: effectiveUserText,
          })
        )
      : Promise.resolve(null);
  const [modelMessages, promptContext, mempalaceRecallContext] = await Promise.all([
    modelMessagesPromise,
    promptContextPromise,
    mempalaceRecallPromise,
  ]);
  const outboundModelMessages = sanitizeOutboundModelMessages(modelMessages).map(
    (message) => ensureModelMessageImageTokenAlignment(message)
  );
  const resolvedAgent = getChatAgentById(resolvedAgentId);
  const freeTierWebResearch =
    aiModel === "gamma" && effectiveUserText
      ? await buildFreeTierWebResearchContext({
          userText: effectiveUserText,
          profile: {
            businessName: promptContext.profile?.business_name ?? null,
            businessType: promptContext.profile?.business_type ?? null,
          },
          project: promptContext.project
            ? {
                name: promptContext.project.name ?? null,
                description: promptContext.project.description ?? null,
              }
            : null,
          memories: promptContext.memories.map((memory) => ({
            content: memory.content ?? null,
            importance: memory.importance ?? null,
            memoryType: memory.memory_type ?? null,
          })),
        })
      : null;

  const includeWebTools = !freeTierWebResearch;
  const baseSystemPrompt = buildSystemPrompt({
    context: promptContext,
    agent: resolvedAgent,
    webResearchMode: freeTierWebResearch
      ? "prefetched"
      : includeWebTools
        ? "tools"
        : "none",
    responseMode: "deep",
    isDesktopApp,
  });
  const systemPrompt = mempalaceRecallContext
    ? `${baseSystemPrompt}\n\n${mempalaceRecallContext}`
    : baseSystemPrompt;

  if (freeTierWebResearch) {
    console.info("Free-tier web research mode", {
      userId: user.uid,
      chatId: resolvedChatId,
      ...freeTierWebResearch.metadata,
    });
  }

  const modelOption = resolveChatModelOption(aiModel);
  const selectedProviderModel = resolveChatProviderModel(aiModel, {
    hasImageInput: messages.some((message) => messageHasImageParts(message)),
  });
  const tradingPairIntent = detectTradingPairIntent(effectiveUserText);
  const shouldForceTradingTool =
    Boolean(tradingPairIntent) &&
    !isVerifiedTraderSignalRequest(effectiveUserText);
  const tools = !effectiveUserText
    ? null
    : await createToolRegistry(
        {
          userId: user.uid,
          adminDb,
          chatId: resolvedChatId,
          projectId: resolvedProjectId,
          chatProviderModel: selectedProviderModel,
          isDesktopApp,
        },
        {
          includeWebTools,
        }
      );

  const gmailComposeIntent = effectiveUserText
    ? detectGmailComposeIntent(effectiveUserText, {
        businessName: promptContext.profile?.business_name,
      })
    : null;

  if (shouldForceTradingTool && tradingPairIntent && tools && resolvedChatId) {
    const toolCallId = `getTradingOpinion-${crypto.randomUUID()}`;
    const assistantMessageId = crypto.randomUUID();
    const tradingToolInput = {
      symbol: tradingPairIntent.symbol,
      timeframe: tradingPairIntent.timeframe,
    };
    const getTradingOpinionExecute = tools.getTradingOpinion.execute;
    if (!getTradingOpinionExecute) {
      return new Response(
        JSON.stringify({ error: "Trading opinion tool is unavailable." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const tradingToolOutput = await getTradingOpinionExecute(tradingToolInput, {
      toolCallId,
      messages: outboundModelMessages,
    });
    const assistantText = buildTradingOpinionSummary(tradingToolOutput);
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName: "getTradingOpinion",
        args: tradingToolInput,
      },
      {
        type: "tool-result",
        toolCallId,
        toolName: "getTradingOpinion",
        result: tradingToolOutput,
      },
    ];

    if (assistantText) {
      assistantContent.push({
        type: "text",
        text: assistantText,
      });
    }

    const nowIso = new Date().toISOString();
    const storedParts = normalizeStoredParts(assistantContent);
    const tradingToolOutputRecord: Record<string, unknown> | null =
      isRecord(tradingToolOutput) ? tradingToolOutput : null;
    const toolErrors =
      typeof tradingToolOutputRecord?.error === "string"
        ? [
            {
              toolName: "getTradingOpinion",
              errorCode: tradingToolOutputRecord.error,
              message:
                typeof tradingToolOutputRecord.errorDetails === "string"
                  ? tradingToolOutputRecord.errorDetails
                  : "Trading opinion returned a fallback response.",
            },
          ]
        : [];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText || null,
        parts: storedParts,
        tool_invocations: [
          {
            toolName: "getTradingOpinion",
            args: tradingToolInput,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualTradingOpinion: true,
          ...(toolErrors.length > 0 ? { toolErrors } : {}),
        },
        created_at: nowIso,
      });

      const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
      const chatSnap = await chatRef.get();
      const existingChat = chatSnap.data() as StoredChat | undefined;
      const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

      if (!existingChat?.title) {
        const trimmed = (effectiveUserText || userMessageSummary).trim();
        if (trimmed) {
          chatUpdates.title =
            trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
        }
      }

      await chatRef.update(chatUpdates);
    } catch (error) {
      console.error("Failed to save manual trading assistant message:", error);
    }

    if (assistantText) {
      void import("@/lib/ai/mempalace").then(({ captureMempalaceConversation }) =>
        captureMempalaceConversation({
          userId: user.uid,
          chatId: resolvedChatId,
          projectId: resolvedProjectId,
          agentId: resolvedAgentId,
          userMessage: effectiveUserText,
          assistantMessage: assistantText,
          provider: "manual-trading-tool",
          model: selectedProviderModel,
        })
      );
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: "start",
          messageId: assistantMessageId,
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
        writer.write({ type: "start-step" });
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: "getTradingOpinion",
          input: tradingToolInput,
          dynamic: true,
        });
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: tradingToolOutput,
          dynamic: true,
        });

        if (assistantText) {
          const textId = `text-${assistantMessageId}`;
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: assistantText });
          writer.write({ type: "text-end", id: textId });
        }

        writer.write({ type: "finish-step" });
        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  if (gmailComposeIntent?.kind === "needs-recipient" && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const assistantText = gmailComposeIntent.message;
    const nowIso = new Date().toISOString();

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText,
        parts: [{ type: "text", text: assistantText }],
        tool_invocations: null,
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualGmailCompose: true,
        },
        created_at: nowIso,
      });

      const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
      const chatSnap = await chatRef.get();
      const existingChat = chatSnap.data() as StoredChat | undefined;
      const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

      if (!existingChat?.title) {
        const trimmed = (effectiveUserText || userMessageSummary).trim();
        if (trimmed) {
          chatUpdates.title =
            trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
        }
      }

      await chatRef.update(chatUpdates);
    } catch (error) {
      console.error("Failed to save Gmail recipient follow-up:", error);
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const textId = `text-${assistantMessageId}`;
        writer.write({
          type: "start",
          messageId: assistantMessageId,
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
        writer.write({ type: "start-step" });
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: assistantText });
        writer.write({ type: "text-end", id: textId });
        writer.write({ type: "finish-step" });
        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  if (gmailComposeIntent?.kind === "compose" && tools && resolvedChatId) {
    const toolCallId = `prepareGmailMessage-${crypto.randomUUID()}`;
    const assistantMessageId = crypto.randomUUID();
    const prepareGmailMessageExecute = tools.prepareGmailMessage.execute;
    if (!prepareGmailMessageExecute) {
      return new Response(
        JSON.stringify({ error: "Gmail compose tool is unavailable." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const gmailToolOutput = await prepareGmailMessageExecute(
      gmailComposeIntent.input,
      {
        toolCallId,
        messages: outboundModelMessages,
      }
    );
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName: "prepareGmailMessage",
        args: gmailComposeIntent.input,
      },
      {
        type: "tool-result",
        toolCallId,
        toolName: "prepareGmailMessage",
        result: gmailToolOutput,
      },
    ];

    const nowIso = new Date().toISOString();
    const storedParts = normalizeStoredParts(assistantContent);
    const gmailToolOutputRecord: Record<string, unknown> | null = isRecord(gmailToolOutput)
      ? gmailToolOutput
      : null;
    const toolErrors =
      gmailToolOutputRecord?.ok === false
        ? [
            {
              toolName: "prepareGmailMessage",
              errorCode:
                typeof gmailToolOutputRecord["errorCode"] === "string"
                  ? gmailToolOutputRecord["errorCode"]
                  : "TOOL_ERROR",
              message:
                typeof gmailToolOutputRecord["message"] === "string"
                  ? gmailToolOutputRecord["message"]
                  : "Gmail compose failed.",
            },
          ]
        : [];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: null,
        parts: storedParts,
        tool_invocations: [
          {
            toolName: "prepareGmailMessage",
            args: gmailComposeIntent.input,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualGmailCompose: true,
          ...(toolErrors.length > 0 ? { toolErrors } : {}),
        },
        created_at: nowIso,
      });

      const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
      const chatSnap = await chatRef.get();
      const existingChat = chatSnap.data() as StoredChat | undefined;
      const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

      if (!existingChat?.title) {
        const trimmed = (effectiveUserText || userMessageSummary).trim();
        if (trimmed) {
          chatUpdates.title =
            trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
        }
      }

      await chatRef.update(chatUpdates);
    } catch (error) {
      console.error("Failed to save Gmail compose assistant message:", error);
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: "start",
          messageId: assistantMessageId,
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
        writer.write({ type: "start-step" });
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: "prepareGmailMessage",
          input: gmailComposeIntent.input,
          dynamic: true,
        });
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: gmailToolOutput,
          dynamic: true,
        });
        writer.write({ type: "finish-step" });
        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  const providerApiKeySource = resolveChatApiKeySource(aiModel);
  const providerApiKey =
    providerApiKeySource === "kimi-k2.5"
      ? process.env.AI_API_KEY?.trim() || process.env.Kimi?.trim()
      : process.env.Gamma?.trim();
  if (!providerApiKey) {
    return new Response(
      JSON.stringify({
        error:
          providerApiKeySource === "kimi-k2.5"
            ? "Chat is not configured: missing AI API key on the server."
            : "Chat is not configured: missing Gamma API key on the server.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const nvidia = createOpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY || providerApiKey,
  });
  const selectedModel = nvidia.chat(selectedProviderModel);
  // NVIDIA-compatible chat streaming currently fails on streamed tool-call chunks
  // for some models, so keep the main chat turn text-only and use explicit pre-call
  // tool execution paths where we need deterministic tool usage.
  const isToolCapableModel = false;

  try {
    const result = streamText({
      model: selectedModel,
      maxOutputTokens: 8192,
      system: freeTierWebResearch
        ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}`
        : isToolCapableModel
          ? systemPrompt
          : `${systemPrompt}\n\nIMPORTANT: You do not have access to tools or functions. Answer the user's question using only your knowledge and any context provided. Do not attempt to call any functions or tools. If you cannot answer without data tools, explain what information you would need and suggest the user upgrade to Pro for real-time data access.`,
      messages: outboundModelMessages,
      ...(isToolCapableModel && tools
        ? {
            tools,
            stopWhen: stepCountIs(CHAT_CONFIG.MAX_TOOL_STEPS),
            prepareStep:
              shouldForceTradingTool && tradingPairIntent
                ? ({ stepNumber }) => {
                    if (stepNumber !== 0) {
                      return undefined;
                    }

                    return {
                      activeTools: ["getTradingOpinion"],
                      toolChoice: {
                        type: "tool",
                        toolName: "getTradingOpinion",
                      },
                      system: `${freeTierWebResearch ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}` : systemPrompt}\n- For this turn, the user gave a trading symbol or pair: ${tradingPairIntent.symbol}.\n- You must call getTradingOpinion first with symbol "${tradingPairIntent.symbol}" and timeframe "${tradingPairIntent.timeframe}".\n- Do not call browser tools, do not open Binance or TradingView, and do not treat a trading pair as a website navigation request.\n- After the tool returns, explain the trade result plainly. If the result is Hold, say there is no clean trade right now.`,
                    };
                  }
                  : undefined,
          }
        : {}),
      onFinish: async (event) => {
        if (!resolvedChatId) return;
        const nowIso = new Date().toISOString();

        // Persist assistant messages to database defensively
        let assistantMessages: AssistantMessageRecord[] = [];
        const response = (event as any).response;
        
        if (response && Array.isArray(response.messages)) {
          assistantMessages = response.messages.filter(
            (message: AssistantMessageRecord) => message.role === "assistant"
          );
        } else if ((event as any).messages && Array.isArray((event as any).messages)) {
          assistantMessages = (event as any).messages.filter(
            (message: AssistantMessageRecord) => message.role === "assistant"
          );
        }

        if (assistantMessages.length === 0) {
          // Construct manually from event if no assistant messages found
          const parts: Array<Record<string, unknown>> = [];
          if (event.text) {
            parts.push({ type: "text", text: event.text });
          }
          if (Array.isArray(event.toolCalls)) {
            for (const tc of event.toolCalls) {
              parts.push({
                type: "tool-call",
                toolCallId: tc?.toolCallId,
                toolName: tc?.toolName,
                args: tc && "args" in tc ? tc.args : {},
              });
            }
          }
          if (parts.length > 0) {
            assistantMessages.push({
              id: (event as any).message?.id,
              role: "assistant",
              content: parts,
            });
          }
        }

        for (const msg of assistantMessages) {
          const content = extractAssistantMessageText(msg.content);

          const toolInvocations = Array.isArray(msg.content)
            ? msg.content
              .filter((p: any) => p.type === "tool-call")
              .map((p: any) => ({
                toolName: "toolName" in p ? p.toolName : "",
                args: "args" in p ? p.args : {},
              }))
            : [];

          const toolErrors = Array.isArray(msg.content)
            ? msg.content
              .map((part: any) => part as ToolResultPart)
              .filter((part: any) => part.type === "tool-result")
              .map((part: any) => {
                const payload =
                  part.result !== undefined ? part.result : part.output;
                if (!payload || typeof payload !== "object") return null;

                const asRecord = payload as Record<string, unknown>;
                if (asRecord.ok !== false) return null;

                return {
                  toolName: part.toolName || "unknown",
                  errorCode:
                    typeof asRecord.errorCode === "string"
                      ? asRecord.errorCode
                      : "TOOL_ERROR",
                  message:
                    typeof asRecord.message === "string"
                      ? asRecord.message
                      : "Tool returned an error.",
                };
              })
              .filter((item: any): item is NonNullable<typeof item> => Boolean(item))
            : [];

          if (toolErrors.length > 0) {
            console.warn("Tool errors detected in assistant response:", toolErrors);
          }

          try {
            const storedParts = normalizeStoredParts(msg.content);
            const hasTextContent = Boolean(content && content.trim().length > 0);
            const hasStoredParts = Boolean(storedParts && storedParts.length > 0);
            if (!hasTextContent && !hasStoredParts) {
              console.warn("Skipped persisting empty assistant message", {
                chatId: resolvedChatId,
              });
              continue;
            }

            const messageId = msg.id;
            const messagePayload = {
              chat_id: resolvedChatId,
              role: "assistant",
              content: content || null,
              parts: storedParts,
              tool_invocations:
                toolInvocations.length > 0 ? toolInvocations : null,
              metadata: {
                model: selectedProviderModel,
                defaultModel: modelOption.providerModel,
                modelTier: aiModel,
                plan: userPlan,
                ...(resolvedAgent
                  ? {
                      agentId: resolvedAgent.id,
                      agentName: resolvedAgent.name,
                    }
                  : {}),
                ...(toolErrors.length > 0 ? { toolErrors } : {}),
                ...(freeTierWebResearch
                  ? { webResearch: freeTierWebResearch.metadata }
                  : {}),
              },
              created_at: nowIso,
            };

            if (messageId) {
              await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageId).set(messagePayload);
            } else {
              await adminDb.collection(COLLECTIONS.MESSAGES).add(messagePayload);
            }
          } catch (error) {
            console.error("Failed to save assistant message:", error);
          }
        }

        const memoryTrace = buildMemoryToolTrace(assistantMessages);
        const assistantTranscript = assistantMessages
          .map((message) => extractAssistantMessageText(message.content))
          .filter(Boolean)
          .join("\n\n");

        if (effectiveUserText && assistantTranscript) {
          void import("@/lib/ai/mempalace").then(({ captureMempalaceConversation }) =>
            captureMempalaceConversation({
              userId: user.uid,
              chatId: resolvedChatId,
              projectId: resolvedProjectId,
              agentId: resolvedAgentId,
              userMessage: effectiveUserText,
              assistantMessage: assistantTranscript,
              provider: "openai-compatible",
              model: selectedProviderModel,
              trace: memoryTrace,
            })
          );
        }

        // Auto-title the chat from the first user message (only once)
        try {
          const chatRef =
            adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
          const chatSnap = await chatRef.get();
          const existingChat = chatSnap.data() as StoredChat | undefined;
          const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

          if (!existingChat?.title) {
            // Get the first user message text to use as title
            const firstUserMsg = outboundModelMessages.find((m) => m.role === "user");
            if (firstUserMsg) {
              const rawText =
                typeof firstUserMsg.content === "string"
                  ? firstUserMsg.content
                  : Array.isArray(firstUserMsg.content)
                    ? firstUserMsg.content
                      .filter((p) => p.type === "text")
                      .map((p) => ("text" in p ? p.text : ""))
                      .join(" ")
                    : "";
              // Truncate to ~60 chars for title
              const trimmed = rawText.trim() || userMessageSummary;
              const title =
                trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
              if (title) {
                chatUpdates.title = title;
              }
            }
          }

          await chatRef.update(chatUpdates);
        } catch (error) {
          console.error("Failed to update chat title:", error);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === "start" || part.type === "finish") {
          return {
            chatId: resolvedChatId,
          };
        }

        return undefined;
      },
    });
  } catch (error) {
    console.error("Chat AI error:", error);
    const message = getReadableErrorMessage(
      error,
      "AI model failed to respond. Please try again."
    );

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  } catch (error) {
    console.error("Chat request error:", error);

    const message = getReadableErrorMessage(
      error,
      "Chat request failed. Please try again."
    );

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
