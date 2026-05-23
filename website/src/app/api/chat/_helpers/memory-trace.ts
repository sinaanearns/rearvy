import {
  type AssistantMessageRecord,
  type MemoryToolTrace,
  isRecord,
} from "./types";

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

export function buildMemoryToolTrace(
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
