export type ChatTokenUsageSource = "provider" | "budget";

export type ChatTokenUsageMetadata = {
  source: ChatTokenUsageSource;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  contextWindowTokens: number;
  remainingTokens: number;
  maxOutputTokens: number;
};

export const DEFAULT_CHAT_CONTEXT_WINDOW_TOKENS = 128_000;
export const DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 8192;
export const DEEPSEEK_V4_PRO_CONTEXT_WINDOW_TOKENS = 1_000_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toTokenCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value);
}

function addTokenCounts(...values: Array<number | undefined>) {
  const knownValues = values.filter((value): value is number => value !== undefined);
  if (knownValues.length === 0) {
    return undefined;
  }

  return knownValues.reduce((sum, value) => sum + value, 0);
}

export function getChatContextWindowTokens(providerModel: unknown) {
  const model =
    typeof providerModel === "string" ? providerModel.trim().toLowerCase() : "";

  if (model === "deepseek-ai/deepseek-v4-pro" || model.endsWith("/deepseek-v4-pro")) {
    return DEEPSEEK_V4_PRO_CONTEXT_WINDOW_TOKENS;
  }

  return DEFAULT_CHAT_CONTEXT_WINDOW_TOKENS;
}

export function normalizeProviderTokenUsage(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const inputTokenDetails = asRecord(record.inputTokenDetails);
  const outputTokenDetails = asRecord(record.outputTokenDetails);
  const inputTokens = toTokenCount(record.inputTokens ?? record.promptTokens);
  const outputTokens = toTokenCount(record.outputTokens ?? record.completionTokens);
  const reasoningTokens = toTokenCount(
    outputTokenDetails?.reasoningTokens ?? record.reasoningTokens
  );
  const cachedInputTokens = toTokenCount(
    inputTokenDetails?.cacheReadTokens ?? record.cachedInputTokens
  );
  const totalTokens =
    toTokenCount(record.totalTokens) ?? addTokenCounts(inputTokens, outputTokens);

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined &&
    reasoningTokens === undefined &&
    cachedInputTokens === undefined
  ) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokens ?? 0,
    reasoningTokens,
    cachedInputTokens,
  };
}

export function buildChatTokenUsageMetadata(params: {
  usage?: unknown;
  providerModel?: unknown;
  maxOutputTokens?: number;
}): ChatTokenUsageMetadata {
  const contextWindowTokens = getChatContextWindowTokens(params.providerModel);
  const maxOutputTokens =
    toTokenCount(params.maxOutputTokens) ?? DEFAULT_CHAT_MAX_OUTPUT_TOKENS;
  const usage = normalizeProviderTokenUsage(params.usage);

  if (!usage) {
    return {
      source: "budget",
      totalTokens: 0,
      contextWindowTokens,
      remainingTokens: contextWindowTokens,
      maxOutputTokens,
    };
  }

  return {
    source: "provider",
    ...usage,
    contextWindowTokens,
    remainingTokens: Math.max(0, contextWindowTokens - usage.totalTokens),
    maxOutputTokens,
  };
}

export function isChatTokenUsageMetadata(
  value: unknown
): value is ChatTokenUsageMetadata {
  const record = asRecord(value);
  if (!record) {
    return false;
  }

  return (
    (record.source === "provider" || record.source === "budget") &&
    toTokenCount(record.totalTokens) !== undefined &&
    toTokenCount(record.contextWindowTokens) !== undefined &&
    toTokenCount(record.remainingTokens) !== undefined &&
    toTokenCount(record.maxOutputTokens) !== undefined
  );
}
