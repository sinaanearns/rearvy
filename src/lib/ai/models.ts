import type { SubscriptionPlan } from "@/lib/plans";
import { CHAT_CONFIG } from "@/lib/utils/constants";

export type ChatModelTier = "free" | "paid";

export type ChatModelOption = {
  id: ChatModelTier;
  label: string;
  description: string;
  provider: "openai" | "nvidia";
  providerModel: string;
};

export const CHAT_MODEL_OPTIONS: Record<ChatModelTier, ChatModelOption> = {
  free: {
    id: "free",
    label: "Kimi K2",
    description: "Included in Free",
    provider: "nvidia",
    providerModel: "moonshotai/kimi-k2-instruct",
  },
  paid: {
    id: "paid",
    label: "GPT-4o",
    description: "Included in Pro",
    provider: "openai",
    providerModel: CHAT_CONFIG.MODEL,
  },
};

export function isChatModelTier(value: unknown): value is ChatModelTier {
  return value === "free" || value === "paid";
}

export function getAvailableChatModels(
  plan: SubscriptionPlan
): ChatModelOption[] {
  return plan === "pro"
    ? [CHAT_MODEL_OPTIONS.free, CHAT_MODEL_OPTIONS.paid]
    : [CHAT_MODEL_OPTIONS.free];
}

export function getDefaultChatModelTier(plan: SubscriptionPlan): ChatModelTier {
  return plan === "pro" ? "paid" : "free";
}

export function resolveChatModelTier(
  requestedModel: unknown,
  plan: SubscriptionPlan
): ChatModelTier {
  if (plan !== "pro") {
    return "free";
  }

  return isChatModelTier(requestedModel)
    ? requestedModel
    : getDefaultChatModelTier(plan);
}
