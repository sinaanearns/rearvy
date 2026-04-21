export type SubscriptionPlan = "free";

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

export const REARVY_PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free Access",
    price: "$0",
    period: "/month",
    description: "Agency AI workspace for connected client data",
    ctaLabel: "Start Free",
    features: [
      "Chat across connected client data",
      "Projects for client workspaces or campaigns",
      "Insights, alerts, and saved context",
      "Demo workspace and integration testing",
      "Free access during the current rollout",
    ],
  },
];

export function getPlanDefinition(plan?: string | null) {
  return REARVY_PLANS.find((entry) => entry.id === plan) ?? REARVY_PLANS[0];
}
