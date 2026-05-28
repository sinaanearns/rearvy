import type { UIMessage } from "ai";

type DisplayMessage = Pick<UIMessage, "role" | "parts" | "metadata">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeSignatureText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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

function getToolPayload(part: Record<string, unknown>) {
  const payload = isRecord(part.output)
    ? part.output
    : isRecord(part.result)
      ? part.result
      : null;

  return payload;
}

function getManualMediaGenerationSignature(message: DisplayMessage) {
  if (message.role !== "assistant") {
    return null;
  }

  const metadata = isRecord(message.metadata) ? message.metadata : null;
  const isManualMedia =
    metadata?.manualMediaGeneration === true ||
    metadata?.manualDesignGeneration === true;
  const parts = Array.isArray(message.parts) ? message.parts : [];

  for (const part of parts) {
    const partRecord = asRecord(part);
    if (!partRecord) {
      continue;
    }

    if (getToolName(partRecord) !== "generateMedia") {
      continue;
    }

    const input = asRecord(partRecord.input);
    const payload = getToolPayload(partRecord);
    const originalPrompt = firstNonEmptyString(
      payload?.originalPrompt,
      input?.originalPrompt
    );
    const generatedPrompt = firstNonEmptyString(payload?.prompt, input?.prompt);
    const prompt = originalPrompt ?? generatedPrompt;

    if (!prompt || (!isManualMedia && !originalPrompt)) {
      return null;
    }

    return JSON.stringify({
      mode: firstNonEmptyString(payload?.mode, input?.mode) ?? "media",
      presentation:
        firstNonEmptyString(payload?.presentation, input?.presentation) ?? "",
      prompt: normalizeSignatureText(prompt),
    });
  }

  return null;
}

export function dedupeMessagesForDisplay<TMessage extends DisplayMessage>(
  messages: TMessage[]
): TMessage[] {
  if (messages.length <= 1) {
    return messages;
  }

  const deduped: TMessage[] = [];
  const mediaSignaturesSinceLastUser = new Set<string>();

  for (const message of messages) {
    if (message.role === "user") {
      mediaSignaturesSinceLastUser.clear();
      deduped.push(message);
      continue;
    }

    const mediaSignature = getManualMediaGenerationSignature(message);
    if (mediaSignature && mediaSignaturesSinceLastUser.has(mediaSignature)) {
      continue;
    }

    if (mediaSignature) {
      mediaSignaturesSinceLastUser.add(mediaSignature);
    }

    deduped.push(message);
  }

  return deduped;
}
