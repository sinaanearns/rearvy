import { createServerLogger } from "@/lib/server-logger";
import { executeGoal, type ExecutionContext } from "./brain";
import type { ExecutionResult } from "./brain";

const log = createServerLogger("Execution:ChatDelegate");

export interface ChatDelegateInput {
  message: string;
  userId: string;
  projectId?: string | null;
  chatId?: string | null;
  isDesktopApp?: boolean;
  allowedMcpServerIds?: string[] | null;
  allowedTools?: string[] | null;
}

export interface ChatDelegateOutput {
  /** True when the Unified Brain handled the message and produced an execution result. */
  handled: boolean;
  result?: ExecutionResult;
  /** True when the request should fall through to legacy chat routing. */
  fallback: boolean;
  error?: string;
}

/**
 * Thin integration wrapper between the chat streaming path and the Unified
 * Execution Brain. The chat route can call this BEFORE its legacy deterministic
 * intent handlers. When the brain returns a structured execution result the
 * caller can render it directly; when it falls back to conversational handling
 * the caller continues with the legacy path.
 *
 * This deliberately does NOT modify the 4310-line chat/route.ts. It is a pure
 * function that chat/route.ts can optionally invoke, preserving backward
 * compatibility while enabling natural-language-first execution.
 */
export async function delegateChatToBrain(
  input: ChatDelegateInput
): Promise<ChatDelegateOutput> {
  const { message, userId, projectId, chatId, isDesktopApp, allowedMcpServerIds, allowedTools } = input;

  if (!message || !message.trim()) {
    return { handled: false, fallback: true };
  }

  const ctx: ExecutionContext = {
    userId,
    projectId: projectId ?? null,
    chatId: chatId ?? null,
    isDesktopApp: isDesktopApp ?? false,
    allowedMcpServerIds: allowedMcpServerIds ?? null,
    allowedTools: allowedTools ?? null,
  };

  try {
    const result = await executeGoal(message, ctx);

    if (result.intent.category === "chat") {
      // Conversational — let the legacy chat path generate a normal response.
      return { handled: false, fallback: true, result };
    }

    return { handled: true, fallback: false, result };
  } catch (error) {
    log.warn("Chat delegate failed, falling back to legacy routing.", error);
    return {
      handled: false,
      fallback: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
