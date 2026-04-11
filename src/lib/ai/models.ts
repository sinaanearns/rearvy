import type { SubscriptionPlan } from "@/lib/plans";

export type ChatModelTier = "free";

export type ChatModelOption = {
  id: ChatModelTier;
  label: string;
  description: string;
  provider: "nvidia";
  providerModel: string;
  visionProviderModel?: string;
};

export const CHAT_MODEL_OPTIONS: Record<ChatModelTier, ChatModelOption> = {
  free: {
    id: "free",
    label: "Llama 3.1 70B",
    description: "Free Model",
    provider: "nvidia",
    providerModel: "meta/llama-3.1-70b-instruct",
    visionProviderModel: "meta/llama-3.2-11b-vision-instruct",
  },
};

export function isChatModelTier(value: unknown): value is ChatModelTier {
  return value === "free";
}

export function getAvailableChatModels(
  plan: SubscriptionPlan
): ChatModelOption[] {
  return [CHAT_MODEL_OPTIONS.free];
}

export function getDefaultChatModelTier(plan: SubscriptionPlan): ChatModelTier {
  return "free";
}

export function resolveChatModelTier(
  requestedModel: unknown,
  plan: SubscriptionPlan
): ChatModelTier {
  return "free";
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
