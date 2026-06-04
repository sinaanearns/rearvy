export type SubscriptionPlan = "free" | "pro" | "business";

export type PlanDefinition = {
  id: SubscriptionPlan;
  name: string;
  price: string;
  period: string;
  description: string;
  ctaLabel: string;
  badge?: string;
  features: string[];
};

export const DEFAULT_PLAN: SubscriptionPlan = "free";
export const FREE_PLAN_CREDITS = 1000;
export const FREE_PLAN_CREDITS_LABEL = `${FREE_PLAN_CREDITS.toLocaleString("en-US")} credits`;

export const REARVY_PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free Access",
    price: "$0",
    period: "/month",
    description: "AI business assistant for connected company data",
    ctaLabel: "Start Free",
    features: [
      FREE_PLAN_CREDITS_LABEL,
      "Chat across connected business data",
      "Projects for accounts, teams, or campaigns",
      "Insights, alerts, and saved context",
      "Demo workspace and integration testing",
      "Free access during the current rollout",
    ],
  },
  {
    id: "business",
    name: "Business Access",
    price: "$99",
    period: "/month",
    description: "Business workspace with paid MetaMask activation",
    ctaLabel: "Activate Business",
    badge: "MetaMask",
    features: [
      "∞ credits per month",
      "MetaMask checkout while card billing is paused",
      "Redeem-code activation supported",
      "Business and operator workflows",
    ],
  },
];

export function getPlanDefinition(plan?: string | null) {
  return REARVY_PLANS.find((entry) => entry.id === plan) ?? REARVY_PLANS[0];
}
