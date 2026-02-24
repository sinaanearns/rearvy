import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient, getUserFromRequest } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createToolRegistry } from "@/lib/ai/tools";
import { CHAT_CONFIG } from "@/lib/utils/constants";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, chatId, projectId } = await req.json();

  const {
    data: { user },
  } = await getUserFromRequest(req);

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();

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

