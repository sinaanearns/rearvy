import type { SubscriptionPlan } from "@/lib/plans";

export type ChatModelTier = "free";

export type ChatModelOption = {
  id: ChatModelTier;
  label: string;
  description: string;
  provider: "nvidia";
  providerModel: string;
};

export const CHAT_MODEL_OPTIONS: Record<ChatModelTier, ChatModelOption> = {
  free: {
    id: "free",
    label: "Kimi 2.5",
    description: "Free Model",
    provider: "nvidia",
    providerModel: "moonshotai/kimi-k2-instruct",
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
