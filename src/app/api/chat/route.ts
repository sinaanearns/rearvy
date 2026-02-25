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

  if (chatId) {
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, project_id")
      .eq("id", chatId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (chatError || !chat) {
      return new Response("Chat not found", { status: 404 });
    }

    if (projectId && chat.project_id !== projectId) {
      return new Response("Chat/project mismatch", { status: 400 });
    }

    const lastMessage =
      messages.length > 0
        ? (messages[messages.length - 1] as IncomingMessage)
        : null;
    const isLastMessageUser = lastMessage?.role === "user";
    const userText = lastMessage ? extractMessageText(lastMessage) : "";

    if (isLastMessageUser && userText) {
      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "user",
        content: userText,
        metadata: { source: "chat_request" },
      });
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
      if (!chatId) return;

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

        await supabase.from("messages").insert({
          chat_id: chatId,
          role: "assistant",
          content: content || null,
          tool_invocations:
            toolInvocations.length > 0 ? toolInvocations : null,
          metadata: {
            model: CHAT_CONFIG.MODEL,
          },
        });
      }

      // Auto-title the chat from the first user message (only once)
      const { data: existingChat } = await supabase
        .from("chats")
        .select("title")
        .eq("id", chatId)
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
              .eq("id", chatId);
          }
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
