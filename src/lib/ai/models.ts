import type { SubscriptionPlan } from "@/lib/plans";

export type BuiltInChatModelTier = "gamma" | "kimi-k2.5";
export type ChatModelApiKeySource = "gamma" | "kimi-k2.5";
export type ChatModelTier = BuiltInChatModelTier | `custom:${string}`;

export type ChatModelOption = {
  id: ChatModelTier;
  label: string;
  description: string;
  provider: "nvidia";
  providerModel: string;
  visionProviderModel?: string;
  apiKeySource: ChatModelApiKeySource;
  isCustom?: boolean;
};

const CUSTOM_MODEL_PREFIX = "custom:";

export const CHAT_MODEL_OPTIONS: Record<BuiltInChatModelTier, ChatModelOption> = {
  gamma: {
    id: "gamma",
    label: "Gamma",
    description: "Gemma 4 31B (balanced)",
    provider: "nvidia",
    providerModel: "google/gemma-4-31b-it",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
    apiKeySource: "gamma",
  },
  "kimi-k2.5": {
    id: "kimi-k2.5",
    label: "Kimi K2.5",
    description: "Fast and capable responses",
    provider: "nvidia",
    providerModel: "moonshotai/kimi-k2-instruct",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
    apiKeySource: "kimi-k2.5",
  },
};

function toBuiltInChatModelTier(value: unknown): BuiltInChatModelTier | null {
  if (value === "gamma" || value === "kimi-k2.5") {
    return value;
  }

  return null;
}

function sanitizeChatModelLabel(value: string): string {
  return value.trim().slice(0, 64);
}

function sanitizeProviderModel(value: string): string {
  return value.trim().slice(0, 200);
}

export function buildCustomChatModelId(params: {
  providerModel: string;
  apiKeySource: ChatModelApiKeySource;
}): ChatModelTier {
  const providerModel = sanitizeProviderModel(params.providerModel);
  const encodedModel = encodeURIComponent(providerModel);
  return `${CUSTOM_MODEL_PREFIX}${params.apiKeySource}:${encodedModel}`;
}

export function parseCustomChatModelId(value: unknown): ChatModelOption | null {
  if (typeof value !== "string" || !value.startsWith(CUSTOM_MODEL_PREFIX)) {
    return null;
  }

  const raw = value.slice(CUSTOM_MODEL_PREFIX.length);
  const splitIndex = raw.indexOf(":");
  if (splitIndex <= 0) {
    return null;
  }

  const sourceRaw = raw.slice(0, splitIndex);
  const encodedProviderModel = raw.slice(splitIndex + 1);
  if (!encodedProviderModel) {
    return null;
  }

  const builtInSource = toBuiltInChatModelTier(sourceRaw);
  if (!builtInSource) {
    return null;
  }

  let decodedProviderModel = "";
  try {
    decodedProviderModel = decodeURIComponent(encodedProviderModel);
  } catch {
    return null;
  }

  const providerModel = sanitizeProviderModel(decodedProviderModel);
  if (!providerModel) {
    return null;
  }

  return {
    id: value as ChatModelTier,
    label: sanitizeChatModelLabel(providerModel),
    description: `Custom NVIDIA model via ${
      builtInSource === "gamma" ? "Gamma" : "Kimi"
    } key`,
    provider: "nvidia",
    providerModel,
    apiKeySource: builtInSource,
    isCustom: true,
  };
}

export function createCustomChatModelOption(params: {
  label: string;
  providerModel: string;
  apiKeySource: ChatModelApiKeySource;
}): ChatModelOption | null {
  const providerModel = sanitizeProviderModel(params.providerModel);
  if (!providerModel) {
    return null;
  }

  const label = sanitizeChatModelLabel(params.label) || providerModel;
  const id = buildCustomChatModelId({
    providerModel,
    apiKeySource: params.apiKeySource,
  });

  return {
    id,
    label,
    description: `Custom NVIDIA model via ${
      params.apiKeySource === "gamma" ? "Gamma" : "Kimi"
    } key`,
    provider: "nvidia",
    providerModel,
    apiKeySource: params.apiKeySource,
    isCustom: true,
  };
}

export function sanitizeCustomChatModelOptions(
  models: ChatModelOption[]
): ChatModelOption[] {
  const seen = new Set<string>();
  const safeModels: ChatModelOption[] = [];

  for (const model of models) {
    if (!model?.isCustom) {
      continue;
    }

    const parsed = parseCustomChatModelId(model.id);
    if (!parsed || seen.has(parsed.id)) {
      continue;
    }

    safeModels.push({
      ...parsed,
      label: sanitizeChatModelLabel(model.label) || parsed.label,
      description: sanitizeChatModelLabel(model.description) || parsed.description,
    });
    seen.add(parsed.id);
  }

  return safeModels;
}

export function isChatModelTier(value: unknown): value is ChatModelTier {
  return toBuiltInChatModelTier(value) !== null || parseCustomChatModelId(value) !== null;
}

export function getAvailableChatModels(
  plan: SubscriptionPlan,
  customModels: ChatModelOption[] = []
): ChatModelOption[] {
  void plan;
  return [
    CHAT_MODEL_OPTIONS.gamma,
    CHAT_MODEL_OPTIONS["kimi-k2.5"],
    ...sanitizeCustomChatModelOptions(customModels),
  ];
}

export function resolveChatModelTier(
  requestedModel: unknown,
  plan: SubscriptionPlan
): ChatModelTier | null {
  void plan;
  if (requestedModel === "free") {
    return "gamma";
  }

  if (isChatModelTier(requestedModel)) {
    return requestedModel;
  }

  return null;
}

export function resolveChatProviderModel(
  tier: ChatModelTier,
  options?: {
    hasImageInput?: boolean;
  }
): string {
  const builtInTier = toBuiltInChatModelTier(tier);
  if (builtInTier) {
    const model = CHAT_MODEL_OPTIONS[builtInTier];

    if (options?.hasImageInput && model.visionProviderModel) {
      return model.visionProviderModel;
    }

    return model.providerModel;
  }

  const customModel = parseCustomChatModelId(tier);
  if (customModel) {
    return customModel.providerModel;
  }

  return CHAT_MODEL_OPTIONS.gamma.providerModel;
}

export function resolveChatModelOption(tier: ChatModelTier): ChatModelOption {
  const builtInTier = toBuiltInChatModelTier(tier);
  if (builtInTier) {
    return CHAT_MODEL_OPTIONS[builtInTier];
  }

  const customModel = parseCustomChatModelId(tier);
  if (customModel) {
    return customModel;
  }

  return CHAT_MODEL_OPTIONS.gamma;
}

export function resolveChatApiKeySource(
  tier: ChatModelTier
): ChatModelApiKeySource {
  return resolveChatModelOption(tier).apiKeySource;
}
