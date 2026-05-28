import type { UIMessage } from "ai";

const CLIENT_CONTINUATION_TOOL_NAMES = new Set([
  "askUser",
  "requestBrowserConnection",
]);

const COMPLETE_CLIENT_TOOL_STATES = new Set([
  "output-available",
  "output-error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isToolPart(part: unknown): part is Record<string, unknown> {
  if (!isRecord(part) || typeof part.type !== "string") {
    return false;
  }

  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function asToolPart(part: unknown) {
  return isToolPart(part) ? part : null;
}

function getToolName(part: Record<string, unknown>) {
  if (typeof part.toolName === "string" && part.toolName.trim()) {
    return part.toolName.trim();
  }

  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.replace(/^tool-/, "");
  }

  return "";
}

function getState(part: Record<string, unknown>) {
  return typeof part.state === "string" ? part.state : "";
}

export function lastAssistantMessageIsCompleteWithClientToolCalls({
  messages,
}: {
  messages: UIMessage[];
}) {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return false;
  }

  const parts = Array.isArray(message.parts) ? message.parts : [];
  const lastStepStartIndex = parts.reduce((lastIndex, part, index) => {
    return isRecord(part) && part.type === "step-start" ? index : lastIndex;
  }, -1);

  const lastStepToolParts = parts
    .slice(lastStepStartIndex + 1)
    .flatMap((part) => {
      const toolPart = asToolPart(part);
      return toolPart && toolPart.providerExecuted !== true ? [toolPart] : [];
    });

  return (
    lastStepToolParts.some((part) =>
      CLIENT_CONTINUATION_TOOL_NAMES.has(getToolName(part))
    ) &&
    lastStepToolParts.every((part) =>
      COMPLETE_CLIENT_TOOL_STATES.has(getState(part))
    )
  );
}
