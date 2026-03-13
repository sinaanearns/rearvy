import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createToolRegistry } from "@/lib/ai/tools";
import { CHAT_MODEL_OPTIONS, resolveChatModelTier } from "@/lib/ai/models";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import {
  performWebPageFetch,
  performWebSearch,
} from "@/lib/ai/tools/web";
import { DEFAULT_PLAN, type SubscriptionPlan } from "@/lib/plans";
import { CHAT_CONFIG } from "@/lib/utils/constants";
import type { NextRequest } from "next/server";

type IncomingMessagePart = {
  type?: unknown;
  text?: unknown;
};

type IncomingMessage = {
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
};

type StoredProfile = {
  plan?: SubscriptionPlan | null;
};

type FreeTierWebResearchContext = {
  systemAddition: string;
};

function normalizeStoredParts(content: unknown): unknown[] | null {
  if (Array.isArray(content)) {
    const sanitizedParts = content.flatMap((part) => {
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
    });

    return sanitizedParts.length > 0 ? sanitizedParts : null;
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

function extractMessageText(message: IncomingMessage): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  const contentParts = Array.isArray(message.content) ? message.content : [];
  const messageParts = Array.isArray(message.parts) ? message.parts : [];
  const parts = contentParts.length > 0 ? contentParts : messageParts;

  const text = parts
    .map((part) => part as IncomingMessagePart)
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text))
    .join("\n")
    .trim();

  return text;
}

function isLikelyWebResearchRequest(text: string): boolean {
  const normalized = text.toLowerCase();

  return (
    /\b(search|browse|look up|google|research)\b/.test(normalized) &&
      /\b(web|internet|competitor|competitors|market|trend|latest|current|store|stores)\b/.test(normalized) ||
    /\b(search the web|search web|browse the web|from the web|look it up)\b/.test(normalized) ||
    /\bcompetitor|competitors|market research|latest trends|current trends\b/.test(normalized)
  );
}

function normalizeWebResearchQuery(text: string): string | null {
  const query = text
    .replace(/^(can you|could you|please|hey|hi|hello)\s+/i, "")
    .replace(/\b(search|browse|look up|google|research)\b/gi, " ")
    .replace(/\b(the )?web\b/gi, " ")
    .replace(/\bfor me\b/gi, " ")
    .replace(/[?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !query ||
    /^(search|browse|web|internet|look up|research)$/i.test(query)
  ) {
    return null;
  }

  return query;
}

async function buildFreeTierWebResearchContext(
  userText: string
): Promise<FreeTierWebResearchContext | null> {
  if (!isLikelyWebResearchRequest(userText)) {
    return null;
  }

  const query = normalizeWebResearchQuery(userText);

  if (!query) {
    return {
      systemAddition:
        "FREE-TIER WEB RESEARCH MODE: The user asked for a web search but did not give a specific topic. Ask one short follow-up question to clarify what to search.",
    };
  }

  const search = await performWebSearch(query, 6);
  const topResults = search.results.slice(0, 3);
  const fetchedPages = await Promise.all(
    topResults.map((result) => performWebPageFetch(result.url, 2200))
  );

  const resultsSection =
    topResults.length > 0
      ? topResults
          .map(
            (result) =>
              `- ${result.title} | ${result.source} | ${result.url}\n  Snippet: ${result.snippet || "No snippet provided."}`
          )
          .join("\n")
      : "- No public web results were found for this query.";

  const pagesSection =
    fetchedPages.length > 0
      ? fetchedPages
          .map((page, index) => {
            const sourceLine = topResults[index]
              ? `${topResults[index].title} | ${topResults[index].source}`
              : page.url;
            return `Source ${index + 1}: ${sourceLine}\n${page.content || page.message}`;
          })
          .join("\n\n")
      : "No page excerpts available.";

  return {
    systemAddition: `FREE-TIER WEB RESEARCH MODE:
You are using Kimi only. Do not call tools in this response.
The server already collected public web research for the user.
Answer using the research below, be concise, and cite source domains inline.
If the research is weak, say that clearly and give the best next step.

Search query: ${query}
Search status: ${search.message}

Search results:
${resultsSection}

Readable source excerpts:
${pagesSection}`,
  };
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  const messages = sanitizeIncomingMessages(rawMessages);
  const chatId = typeof payload?.chatId === "string" ? payload.chatId : null;
  const projectId =
    typeof payload?.projectId === "string" ? payload.projectId : null;

  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const user = auth.user!;
  const profileSnap = await adminDb
    .collection(COLLECTIONS.PROFILES)
    .doc(user.uid)
    .get();
  const profile = profileSnap.data() as StoredProfile | undefined;
  const userPlan = profile?.plan === "pro" ? "pro" : DEFAULT_PLAN;
  const aiModel = resolveChatModelTier(payload?.aiModel, userPlan);

  const lastMessage =
    messages.length > 0
      ? (messages[messages.length - 1] as IncomingMessage)
      : null;
  const isLastMessageUser = lastMessage?.role === "user";
  const userText = lastMessage ? extractMessageText(lastMessage) : "";
  let resolvedChatId = chatId;

    if (resolvedChatId) {
      const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
      const chatSnap = await chatRef.get();
      const chat = chatSnap.data() as StoredChat | undefined;
  
      const isOwner = chat?.user_id === user.uid;
      const isParticipant = Array.isArray(chat?.participant_ids) && chat.participant_ids.includes(user.uid);
  
      if (!chat || (!isOwner && !isParticipant)) {
        return new Response("Chat not found", { status: 404 });
      }

    if (projectId && chat.project_id !== projectId) {
      return new Response("Chat/project mismatch", { status: 400 });
    }
  } else {
    if (!isLastMessageUser || !userText) {
      return new Response("Missing user message", { status: 400 });
    }

    if (projectId) {
      const projectRef = adminDb
        .collection(COLLECTIONS.PROJECTS)
        .doc(projectId);
      const projectSnap = await projectRef.get();
      const project = projectSnap.data() as StoredProject | undefined;

      if (!project || project.user_id !== user.uid) {
        return new Response("Project not found", { status: 404 });
      }
    }

    try {
      const createdChatRef = await adminDb
        .collection(COLLECTIONS.CHATS)
        .add({
          user_id: user.uid,
          participant_ids: [user.uid],
          project_id: projectId,
          title: null,
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

  if (isLastMessageUser && userText) {
    if (!resolvedChatId) {
      return new Response("Chat not ready", { status: 500 });
    }

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).add({
        chat_id: resolvedChatId,
        role: "user",
        content: userText,
        parts: [{ type: "text", text: userText }],
        tool_invocations: null,
        metadata: { source: "chat_request" },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to persist user message:", error);
      return new Response("Failed to save message", { status: 500 });
    }
  }

  const tools = createToolRegistry({ userId: user.uid, adminDb });
  const systemPrompt = await buildSystemPrompt({
    userId: user.uid,
    projectId,
    adminDb,
  });

  const modelMessages = await convertToModelMessages(
    messages as Parameters<typeof convertToModelMessages>[0]
  );
  const freeTierWebResearch =
    aiModel === "free"
      ? await buildFreeTierWebResearchContext(userText)
      : null;

  // Select model based on aiModel choice
  const nvidia = createOpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY,
  });
  const modelOption = CHAT_MODEL_OPTIONS[aiModel];

  const selectedModel =
    modelOption.provider === "nvidia"
      ? nvidia.chat(modelOption.providerModel)
      : openai(modelOption.providerModel);

  try {
    const result = streamText({
      model: selectedModel,
      system: freeTierWebResearch
        ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}`
        : systemPrompt,
      messages: modelMessages,
      ...(freeTierWebResearch
        ? {}
        : {
            tools,
            stopWhen: stepCountIs(CHAT_CONFIG.MAX_TOOL_STEPS),
          }),
    onFinish: async ({ response }) => {
      if (!resolvedChatId) return;

      // Persist assistant messages to database
      const assistantMessages = response.messages.filter(
        (m) => m.role === "assistant"
      );

      for (const msg of assistantMessages) {
        const rawContent =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
              .filter((p) => p.type === "text")
              .map((p) => ("text" in p ? p.text : ""))
              .join("");
        const content = sanitizeAssistantText(rawContent);

        const toolInvocations = Array.isArray(msg.content)
          ? msg.content
            .filter((p) => p.type === "tool-call")
            .map((p) => ({
              toolName: "toolName" in p ? p.toolName : "",
              args: "args" in p ? p.args : {},
            }))
          : [];

        const toolErrors = Array.isArray(msg.content)
          ? msg.content
            .map((part) => part as ToolResultPart)
            .filter((part) => part.type === "tool-result")
            .map((part) => {
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
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
          : [];

        if (toolErrors.length > 0) {
          console.warn("Tool errors detected in assistant response:", toolErrors);
        }

        try {
          await adminDb.collection(COLLECTIONS.MESSAGES).add({
            chat_id: resolvedChatId,
            role: "assistant",
            content: content || null,
            parts: normalizeStoredParts(msg.content),
            tool_invocations:
              toolInvocations.length > 0 ? toolInvocations : null,
            metadata: {
              model: modelOption.providerModel,
              modelTier: aiModel,
              plan: userPlan,
              ...(toolErrors.length > 0 ? { toolErrors } : {}),
            },
            created_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Failed to save assistant message:", error);
        }
      }

      // Auto-title the chat from the first user message (only once)
      try {
        const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
        const chatSnap = await chatRef.get();
        const existingChat = chatSnap.data() as StoredChat | undefined;

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
            const trimmed = rawText.trim();
            const title =
              trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
            if (title) {
              await chatRef.update({ title });
            }
          }
        }
      } catch (error) {
        console.error("Failed to update chat title:", error);
      }
    },
  });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === "start" && resolvedChatId) {
          return { chatId: resolvedChatId };
        }
      },
    });
  } catch (error) {
    console.error("Chat AI error:", error);
    return new Response(
      JSON.stringify({ error: "AI model failed to respond. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
