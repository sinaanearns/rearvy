import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { buildFreeTierWebResearchContext } from "@/lib/ai/free-tier-web-research";
import {
  buildSystemPrompt,
  loadSystemPromptContext,
} from "@/lib/ai/system-prompt";
import { createToolRegistry } from "@/lib/ai/tools";
import {
  CHAT_MODEL_OPTIONS,
  resolveChatModelTier,
  resolveChatProviderModel,
} from "@/lib/ai/models";
import {
  buildStoredUserMessageParts,
  buildUserMessageSummary,
  extractIncomingMessageText,
  messageHasImageParts,
  normalizeIncomingMessagesForModel,
} from "@/lib/ai/message-parts";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import { DEFAULT_PLAN } from "@/lib/plans";
import { CHAT_CONFIG } from "@/lib/utils/constants";
import {
  extractAutoMemoryCandidate,
  saveMemoryRecord,
} from "@/lib/memory-store";
import { detectAndProcessCommand } from "@/lib/ai/smart-commands";
import type { NextRequest } from "next/server";

type IncomingMessage = {
  id?: string;
  role?: unknown;
  content?: unknown;
  parts?: unknown;
};

type ToolResultPart = {
  type?: string;
  toolName?: string;
  result?: unknown;
  output?: unknown;
};

type StoredChat = {
  user_id?: string;
  participant_ids?: string[];
  project_id?: string | null;
  title?: string | null;
};

type StoredProject = {
  user_id?: string;
  name?: string | null;
  description?: string | null;
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

    return sanitizedParts.length > 0 ? deepStripUndefined(sanitizedParts) : null;
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
  const [payload, auth] = await Promise.all([req.json(), requireAuth(req)]);
  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  const messages = trimTrailingAssistantPlaceholders(
    sanitizeIncomingMessages(rawMessages)
  );
  const messagesForModel = normalizeIncomingMessagesForModel(messages);
  const chatId = typeof payload?.chatId === "string" ? payload.chatId : null;
  const projectId =
    typeof payload?.projectId === "string" ? payload.projectId : null;

  if (auth.error) {
    return auth.error;
  }
  const user = auth.user!;
  const aiModel = resolveChatModelTier(payload?.aiModel, DEFAULT_PLAN);
  if (!aiModel) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid aiModel. Please retry with a supported model without auto-switching.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const deepThinking = payload?.deepThinking === true;

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
    responseMode: deepThinking ? "deep" : "fast",
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
      // Defer write to background - don't block response streaming
      void batch.commit().catch((error) => {
        console.error("Failed to persist user message:", error);
      });
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
  let finalMessagesForModel = messagesForModel;
  
  if (commandResult.hasCommand && effectiveUserText && messagesForModel.length > 0) {
    const latestUserIndex = [...messagesForModel]
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
      const latestUserMessageForModel = messagesForModel[latestUserIndex];
      if (
        typeof latestUserMessageForModel === "object" &&
        latestUserMessageForModel !== null
      ) {
        const updatedUserMsg = {
          ...latestUserMessageForModel,
        } as Record<string, any>;
        updatedUserMsg.content = `[INSTRUCTION: ${commandResult.instruction}]\n\nUser request: ${effectiveUserText}`;

        finalMessagesForModel = messagesForModel.map((message, index) =>
          index === latestUserIndex ? updatedUserMsg : message
        );
      }
    }
  }

  const modelMessagesPromise = convertToModelMessages(
    finalMessagesForModel as Parameters<typeof convertToModelMessages>[0]
  );
  const [modelMessages, promptContext] = await Promise.all([
    modelMessagesPromise,
    promptContextPromise,
  ]);
  const freeTierWebResearch =
    deepThinking && aiModel === "gamma" && effectiveUserText
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

  const tools =
    freeTierWebResearch || !effectiveUserText || !deepThinking
      ? null
      : createToolRegistry(
          { userId: user.uid, adminDb },
          { includeWebTools: deepThinking }
        );
  const systemPrompt = buildSystemPrompt({
    context: promptContext,
    webResearchMode: freeTierWebResearch ? "prefetched" : "tools",
    responseMode: deepThinking ? "deep" : "fast",
  });

  const providerApiKey =
    aiModel === "kimi-k2.5"
      ? process.env.Kimi?.trim()
      : process.env.Gamma?.trim();
  if (!providerApiKey) {
    return new Response(
      JSON.stringify({
        error:
          aiModel === "kimi-k2.5"
            ? "Chat is not configured: missing Kimi API key on the server."
            : "Chat is not configured: missing Gamma API key on the server.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  if (freeTierWebResearch) {
    console.info("Free-tier web research mode", {
      userId: user.uid,
      chatId: resolvedChatId,
      ...freeTierWebResearch.metadata,
    });
  }

  // Select model based on aiModel choice
  const nvidia = createOpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: providerApiKey,
  });
  const modelOption = CHAT_MODEL_OPTIONS[aiModel];
  const selectedProviderModel = resolveChatProviderModel(aiModel, {
    hasImageInput: messages.some((message) => messageHasImageParts(message)),
  });
  const selectedModel = nvidia.chat(selectedProviderModel);

  const isToolCapableModel = true;

  try {
    const result = streamText({
      model: selectedModel,
      system: freeTierWebResearch
        ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}`
        : isToolCapableModel
          ? systemPrompt
          : `${systemPrompt}\n\nIMPORTANT: You do not have access to tools or functions. Answer the user's question using only your knowledge and any context provided. Do not attempt to call any functions or tools. If you cannot answer without data tools, explain what information you would need and suggest the user upgrade to Pro for real-time data access.`,
      messages: modelMessages,
      ...(isToolCapableModel && tools
        ? {
            tools,
            stopWhen: stepCountIs(CHAT_CONFIG.MAX_TOOL_STEPS),
          }
        : {}),
      onFinish: async (event) => {
        if (!resolvedChatId) return;
        const nowIso = new Date().toISOString();

        // Persist assistant messages to database defensively
        let assistantMessages: any[] = [];
        const response = (event as any).response;
        
        if (response && Array.isArray(response.messages)) {
          assistantMessages = response.messages.filter(
            (m: any) => m.role === "assistant"
          );
        } else if ((event as any).messages && Array.isArray((event as any).messages)) {
          assistantMessages = (event as any).messages.filter(
            (m: any) => m.role === "assistant"
          );
        }

        if (assistantMessages.length === 0) {
          // Construct manually from event if no assistant messages found
          const parts: any[] = [];
          if (event.text) {
            parts.push({ type: 'text', text: event.text });
          }
          if (Array.isArray(event.toolCalls)) {
            for (const tc of event.toolCalls) {
              parts.push({ 
                type: 'tool-call', 
                toolCallId: tc?.toolCallId, 
                toolName: tc?.toolName, 
                args: tc && 'args' in tc ? tc.args : {} 
              });
            }
          }
          if (parts.length > 0) {
            assistantMessages.push({ 
              id: (event as any).message?.id,
              role: 'assistant', 
              content: parts 
            });
          }
        }

        for (const msg of assistantMessages) {
          const rawContent =
            typeof msg.content === "string"
              ? msg.content
              : msg.content
                .filter((p: any) => p.type === "text")
                .map((p: any) => ("text" in p ? p.text : ""))
                .join("");
          const content = sanitizeAssistantText(rawContent);

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

        // Auto-title the chat from the first user message (only once)
        try {
          const chatRef =
            adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
          const chatSnap = await chatRef.get();
          const existingChat = chatSnap.data() as StoredChat | undefined;
          const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

          if (!existingChat?.title) {
            // Get the first user message text to use as title
            const firstUserMsg = modelMessages.find((m) => m.role === "user");
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

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat AI error:", error);
    return new Response(
      JSON.stringify({ error: "AI model failed to respond. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
