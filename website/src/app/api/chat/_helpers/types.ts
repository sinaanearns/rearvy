export type IncomingMessage = {
  id?: string;
  role?: unknown;
  content?: unknown;
  parts?: unknown;
};

export type ToolResultPart = {
  type?: string;
  toolCallId?: unknown;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  output?: unknown;
};

export type StoredChat = {
  user_id?: string;
  participant_ids?: string[];
  project_id?: string | null;
  title?: string | null;
};

export type StoredProject = {
  user_id?: string;
  name?: string | null;
  description?: string | null;
};

export type AssistantMessageRecord = {
  id?: string;
  role?: string;
  content?: unknown;
};

export type MemoryToolTrace = {
  tools: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function deepStripUndefined(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(deepStripUndefined);
  }

  const result: Record<string, unknown> = {};
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) {
        result[key] = deepStripUndefined(item);
      }
    }
  }

  return result;
}
