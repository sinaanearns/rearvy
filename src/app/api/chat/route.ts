import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient, getUserFromRequest } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createToolRegistry } from "@/lib/ai/tools";
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
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const chatId = typeof payload?.chatId === "string" ? payload.chatId : null;
  const projectId =
    typeof payload?.projectId === "string" ? payload.projectId : null;

  const {
    data: { user },
  } = await getUserFromRequest(req);

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  const lastMessage =
    messages.length > 0
      ? (messages[messages.length - 1] as IncomingMessage)
      : null;
  const isLastMessageUser = lastMessage?.role === "user";
  const userText = lastMessage ? extractMessageText(lastMessage) : "";
  let resolvedChatId = chatId;

  if (resolvedChatId) {
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, project_id")
      .eq("id", resolvedChatId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (chatError || !chat) {
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
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (projectError || !project) {
        return new Response("Project not found", { status: 404 });
      }
    }

    const { data: createdChat, error: createChatError } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        project_id: projectId,
        title: null,
      })
      .select("id")
      .single();

    if (createChatError || !createdChat) {
      console.error("Failed to create chat:", createChatError);
      return new Response("Failed to create chat", { status: 500 });
    }

    resolvedChatId = createdChat.id;
  }

  if (isLastMessageUser && userText) {
    if (!resolvedChatId) {
      return new Response("Chat not ready", { status: 500 });
    }

    const { error: insertUserMessageError } = await supabase
      .from("messages")
      .insert({
        chat_id: resolvedChatId,
        role: "user",
        content: userText,
        metadata: { source: "chat_request" },
      });

    if (insertUserMessageError) {
      console.error("Failed to persist user message:", insertUserMessageError);
      return new Response("Failed to save message", { status: 500 });
    }
  }

  const tools = createToolRegistry({ userId: user.id, supabase });
  const systemPrompt = await buildSystemPrompt({
    userId: user.id,
    projectId,
    supabase,
  });

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai(CHAT_CONFIG.MODEL),
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(CHAT_CONFIG.MAX_TOOL_STEPS),
    onFinish: async ({ response }) => {
      if (!resolvedChatId) return;

      // Persist assistant messages to database
      const assistantMessages = response.messages.filter(
        (m) => m.role === "assistant"
      );

      for (const msg of assistantMessages) {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : msg.content
              .filter((p) => p.type === "text")
              .map((p) => ("text" in p ? p.text : ""))
              .join("");

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

        await supabase.from("messages").insert({
          chat_id: resolvedChatId,
          role: "assistant",
          content: content || null,
          tool_invocations:
            toolInvocations.length > 0 ? toolInvocations : null,
          metadata: {
            model: CHAT_CONFIG.MODEL,
            ...(toolErrors.length > 0 ? { toolErrors } : {}),
          },
        });
      }

      // Auto-title the chat from the first user message (only once)
      const { data: existingChat } = await supabase
        .from("chats")
        .select("title")
        .eq("id", resolvedChatId)
        .single();

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
            await supabase
              .from("chats")
              .update({ title })
              .eq("id", resolvedChatId);
          }
        }
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
}
