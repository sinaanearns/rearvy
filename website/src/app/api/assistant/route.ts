import { NextRequest } from "next/server";
import { 
  streamText, 
  createUIMessageStreamResponse, 
} from "ai";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { buildSystemPrompt, loadSystemPromptContext } from "@/lib/ai/system-prompt";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("AssistantApi");

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) {
      return error;
    }

    const { messages, model, system, temperature, topP, maxTokens, stop, seed } = await request.json();

    const userId = user.uid;

    // Load the system prompt context
    let context;
    try {
      context = await loadSystemPromptContext({
        userId,
        projectId: null,
        adminDb,
        project: null,
        responseMode: "fast",
        query: null,
      });
    } catch (e) {
      log.warn("Failed to load system prompt context, using empty context", e);
      // Provide a minimal context to avoid breaking the buildSystemPrompt function
      context = {
        profile: undefined,
        integrations: [],
        websites: [],
        memories: [],
        profileMemory: { entries: [], updated_at: null, source: null },
        knowledge: [],
        project: null,
        projectTemplateAddon: null,
      };
    }

    // Build the system prompt
    const systemPrompt = buildSystemPrompt({
      context,
      webResearchMode: "tools",
      responseMode: "fast",
      isDesktopApp: false,
      desktopToolContext: {
        hasDesktopWorkflowTools: false,
        hasBrowserTools: false,
        hasTerminalTools: false,
        hasExternalMcpTools: false,
      },
      unavailableApps: [],
    });

    const result = streamText({
      model: model ?? "auto",
      system: systemPrompt,
      messages: messages,
      temperature: temperature ?? 0.7,
      topP: topP ?? 0.9,
      maxOutputTokens: maxTokens ?? 1024,
      stopSequences: stop ?? [],
      seed: seed ?? undefined,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    log.error("Assistant API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
