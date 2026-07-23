import type { SubscriptionPlan } from "@/lib/plans";

export type BuiltInChatModelTier =
  | "auto"
  | "gamma"
  | "kimi-k2.5"
  | "nemotron-omni"
  | "glm-5.2"
  | "glm-5.1"
  | "deepseek-v4-pro"
  | "mistral-small";
export type ChatModelApiKeySource =
  | "nvidia"
  | "gamma"
  | "kimi-k2.5"
  | "nemotron-omni"
  | "glm-5.2"
  | "glm-5.1"
  | "deepseek-v4-pro"
  | "mistral";
export type ChatModelTier = BuiltInChatModelTier | `custom:${string}`;

export type ChatModelOption = {
  id: ChatModelTier;
  label: string;
  description: string;
  provider: "auto" | "nvidia" | "mistral";
  providerModel: string;
  visionProviderModel?: string;
  apiKeySource: ChatModelApiKeySource;
  isCustom?: boolean;
};

const CUSTOM_MODEL_PREFIX = "custom:";
export const DEFAULT_CHAT_MODEL_TIER: BuiltInChatModelTier = "auto";

function getApiKeySourceLabel(source: ChatModelApiKeySource) {
  if (source === "nvidia") {
    return "NVIDIA";
  }

  if (source === "gamma") {
    return "Gamma";
  }


  if (source === "nemotron-omni") {
    return "Nemotron Omni";
  }

  if (source === "glm-5.2" || source === "glm-5.1") {
    return "GLM 5.2";
  }

  if (source === "deepseek-v4-pro") {
    return "DeepSeek V4 Pro";
  }

  if (source === "mistral") {
    return "Mistral";
  }

  return "AI";
}

export const CHAT_MODEL_OPTIONS: Record<BuiltInChatModelTier, ChatModelOption> = {
  auto: {
    id: "auto",
    label: "Auto",
    description: "Fast router picks the best model",
    provider: "auto",
    providerModel: "auto",
    apiKeySource: "gamma",
  },
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
    label: "Kimi K2.6",
    description: "Moonshot Kimi K2.6 via NVIDIA",
    provider: "nvidia",
    providerModel: "moonshotai/kimi-k2.6",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
    apiKeySource: "kimi-k2.5",
  },

  "nemotron-omni": {
    id: "nemotron-omni",
    label: "Nemotron Omni",
    description: "Nemotron 3 Nano Omni reasoning via NVIDIA",
    provider: "nvidia",
    providerModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
    apiKeySource: "nemotron-omni",
  },
  "glm-5.2": {
    id: "glm-5.2",
    label: "GLM 5.2",
    description: "Z.ai GLM 5.2 via NVIDIA",
    provider: "nvidia",
    providerModel: "z-ai/glm-5.2",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
    apiKeySource: "glm-5.2",
  },
  "glm-5.1": {
    id: "glm-5.1",
    label: "GLM 5.2",
    description: "Z.ai GLM 5.2 via NVIDIA",
    provider: "nvidia",
    providerModel: "z-ai/glm-5.2",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
    apiKeySource: "glm-5.2",
  },
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "DeepSeek V4 Pro via NVIDIA",
    provider: "nvidia",
    providerModel: "deepseek-ai/deepseek-v4-pro",
    apiKeySource: "deepseek-v4-pro",
  },
  "mistral-small": {
    id: "mistral-small",
    label: "Mistral Small",
    description: "Mistral Small Latest",
    provider: "mistral",
    providerModel: "mistral-small-latest",
    apiKeySource: "mistral",
  },
};

function toBuiltInChatModelTier(value: unknown): BuiltInChatModelTier | null {
  if (
    value === "auto" ||
    value === "gamma" ||
    value === "kimi-k2.5" ||
    value === "nemotron-omni" ||
    value === "glm-5.1" ||
    value === "glm-5.2" ||
    value === "deepseek-v4-pro" ||
    value === "mistral-small"
  ) {
    return value;
  }

  return null;
}

function toChatModelApiKeySource(value: unknown): ChatModelApiKeySource | null {
  if (
    value === "nvidia" ||
    value === "gamma" ||
    value === "kimi-k2.5" ||
    value === "nemotron-omni" ||
    value === "glm-5.1" ||
    value === "glm-5.2" ||
    value === "deepseek-v4-pro" ||
    value === "mistral"
  ) {
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

  const builtInSource = toChatModelApiKeySource(sourceRaw);
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
    description: `Custom model via ${getApiKeySourceLabel(
      builtInSource
    )} key`,
    provider: builtInSource === "mistral" ? "mistral" : "nvidia",
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
    description: `Custom model via ${getApiKeySourceLabel(
      params.apiKeySource
    )} key`,
    provider: params.apiKeySource === "mistral" ? "mistral" : "nvidia",
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
  const safeCustomModels = sanitizeCustomChatModelOptions(customModels);
  return [
    CHAT_MODEL_OPTIONS.auto,
    CHAT_MODEL_OPTIONS["kimi-k2.5"],
    CHAT_MODEL_OPTIONS["nemotron-omni"],
    CHAT_MODEL_OPTIONS["glm-5.2"],
    CHAT_MODEL_OPTIONS["glm-5.1"],
    CHAT_MODEL_OPTIONS["deepseek-v4-pro"],
    CHAT_MODEL_OPTIONS["mistral-small"],
    ...safeCustomModels,
  ];
}

export function resolveChatModelTier(
  requestedModel: unknown,
  plan: SubscriptionPlan
): ChatModelTier | null {
  void plan;
  if (requestedModel === "free") {
    return DEFAULT_CHAT_MODEL_TIER;
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

    if (builtInTier === "auto") {
      return model.providerModel;
    }

    if (options?.hasImageInput && model.visionProviderModel) {
      return model.visionProviderModel;
    }

    return model.providerModel;
  }

  const customModel = parseCustomChatModelId(tier);
  if (customModel) {
    return customModel.providerModel;
  }

  return CHAT_MODEL_OPTIONS[DEFAULT_CHAT_MODEL_TIER].providerModel;
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

  return CHAT_MODEL_OPTIONS[DEFAULT_CHAT_MODEL_TIER];
}

export function resolveChatApiKeySource(
  tier: ChatModelTier
): ChatModelApiKeySource {
  return resolveChatModelOption(tier).apiKeySource;
}
