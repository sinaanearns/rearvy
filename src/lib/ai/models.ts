import type { SubscriptionPlan } from "@/lib/plans";

export type ChatModelTier = "gamma" | "kimi-k2.5";

export type ChatModelOption = {
  id: ChatModelTier;
  label: string;
  description: string;
  provider: "nvidia";
  providerModel: string;
  visionProviderModel?: string;
};

export const CHAT_MODEL_OPTIONS: Record<ChatModelTier, ChatModelOption> = {
  gamma: {
    id: "gamma",
    label: "Gamma",
    description: "Gemma 4 31B (balanced)",
    provider: "nvidia",
    providerModel: "google/gemma-4-31b-it",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
  },
  "kimi-k2.5": {
    id: "kimi-k2.5",
    label: "Kimi K2.5",
    description: "Fast and capable responses",
    provider: "nvidia",
    providerModel: "moonshotai/kimi-k2-instruct",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
  },
};

export function isChatModelTier(value: unknown): value is ChatModelTier {
  return value === "gamma" || value === "kimi-k2.5";
}

export function getAvailableChatModels(
  plan: SubscriptionPlan
): ChatModelOption[] {
  void plan;
  return [CHAT_MODEL_OPTIONS.gamma, CHAT_MODEL_OPTIONS["kimi-k2.5"]];
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
  const model = CHAT_MODEL_OPTIONS[tier];

  if (options?.hasImageInput && model.visionProviderModel) {
    return model.visionProviderModel;
  }

  return model.providerModel;
}
