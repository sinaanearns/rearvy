import type { UIMessage } from "ai";

type MessagePart = UIMessage["parts"][number];
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getPartType(part: unknown): string | null {
  if (!isRecord(part) || typeof part.type !== "string") {
    return null;
  }

  return part.type;
}

export function isToolLikeUIPart(part: unknown): part is MessagePart {
  const type = getPartType(part);
  if (!type) {
    return false;
  }

  return (
    type === "dynamic-tool" ||
    type === "tool-call" ||
    type === "tool-result" ||
    type.startsWith("tool-")
  );
}

export function hasCompletedToolUIState(part: unknown): boolean {
  const type = getPartType(part);
  if (!type) {
    return false;
  }

  if (type === "tool-result") {
    return true;
  }

  if (type === "tool-call") {
    return false;
  }

  if (type !== "dynamic-tool" && !type.startsWith("tool-")) {
    return false;
  }

  const state = isRecord(part) && typeof part.state === "string" ? part.state : "";
  return (
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    state === "approval-responded"
  );
}

export function hasRenderableAssistantUIParts(parts: UIMessage["parts"]): boolean {
  return parts.some((part) => {
    const type = getPartType(part);
    if (!type || type === "step-start" || isToolLikeUIPart(part)) {
      return false;
    }

    if (type === "text") {
      if (!isRecord(part)) {
        return false;
      }

      const text = (part as UnknownRecord)["text"];
      return typeof text === "string" && text.trim().length > 0;
    }

    return true;
  });
}

export function insertStepStartsAfterCompletedToolParts(
  parts: UIMessage["parts"]
): UIMessage["parts"] {
  const normalized: MessagePart[] = [];
  let shouldStartNewStep = false;

  for (const part of parts) {
    const type = getPartType(part);
    if (!type) {
      continue;
    }

    if (type === "step-start") {
      shouldStartNewStep = false;
      normalized.push(part);
      continue;
    }

    if (shouldStartNewStep && !isToolLikeUIPart(part)) {
      const lastPart = normalized[normalized.length - 1];
      if (!(isRecord(lastPart) && lastPart.type === "step-start")) {
        normalized.push({ type: "step-start" } as MessagePart);
      }
      shouldStartNewStep = false;
    }

    normalized.push(part);

    if (hasCompletedToolUIState(part)) {
      shouldStartNewStep = true;
    }
  }

  return normalized;
}
