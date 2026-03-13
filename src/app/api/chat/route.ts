import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { buildFreeTierWebResearchContext } from "@/lib/ai/free-tier-web-research";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createToolRegistry } from "@/lib/ai/tools";
import { CHAT_MODEL_OPTIONS, resolveChatModelTier } from "@/lib/ai/models";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
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
  name?: string | null;
  description?: string | null;
};

type StoredProfile = {
  plan?: SubscriptionPlan | null;
  business_name?: string | null;
  business_type?: "shopify" | "content_creator" | "agency" | "other" | null;
};

type StoredMemory = {
  is_active?: boolean;
  importance?: number | null;
  memory_type?: string | null;
  content?: string | null;
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
    if (!isLastMessageUser || !userText) {
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

  const tools = createToolRegistry(
    { userId: user.uid, adminDb },
    { includeWebTools: aiModel !== "free" }
  );
  const systemPrompt = await buildSystemPrompt({
    userId: user.uid,
    projectId: resolvedProjectId,
    adminDb,
    webResearchMode: aiModel === "free" ? "prefetched" : "tools",
  });

  const modelMessages = await convertToModelMessages(
    messages as Parameters<typeof convertToModelMessages>[0]
  );
  const freeTierResearchMemories =
    aiModel === "free"
      ? (
          await adminDb
            .collection(COLLECTIONS.MEMORIES)
            .where("user_id", "==", user.uid)
            .get()
        ).docs
          .map((doc) => doc.data() as StoredMemory)
          .filter((memory) => memory.is_active === true)
          .sort((a, b) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 5)
      : [];
  const freeTierWebResearch =
    aiModel === "free"
      ? await buildFreeTierWebResearchContext({
          userText,
          profile: {
            businessName: profile?.business_name ?? null,
            businessType: profile?.business_type ?? null,
          },
          project: resolvedProject
            ? {
                name: resolvedProject.name ?? null,
                description: resolvedProject.description ?? null,
              }
            : null,
          memories: freeTierResearchMemories.map((memory) => ({
            content: memory.content ?? null,
            importance: memory.importance ?? null,
            memoryType: memory.memory_type ?? null,
          })),
        })
      : null;

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
                ...(freeTierWebResearch
                  ? { webResearch: freeTierWebResearch.metadata }
                  : {}),
              },
              created_at: new Date().toISOString(),
            });
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
