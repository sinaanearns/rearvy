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
    name: "Free",
    price: "$0",
    period: "/month",
    description: "AI-powered business assistant with Kimi 2.5",
    ctaLabel: "Start Free",
    features: [
      "Unlimited workspaces with core dashboards",
      "Chat with your business data",
      "Web research tools and alerts",
      "Project templates and collaboration",
      "Priority support",
    ],
  },
];

export function getPlanDefinition(plan?: string | null) {
  return REARVY_PLANS.find((entry) => entry.id === plan) ?? REARVY_PLANS[0];
}
