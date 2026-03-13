export type SubscriptionPlan = "free" | "pro";

export type PlanDefinition = {
  id: SubscriptionPlan;
  name: string;
  price: string;
  period: string;
  description: string;
  ctaLabel: string;
  badge?: string;
  paymentRequired?: boolean;
  paymentMethods?: string[];
  features: string[];
};

export const DEFAULT_PLAN: SubscriptionPlan = "free";
const PRO_PLAN_PRICE = process.env.NEXT_PUBLIC_PRO_PLAN_PRICE?.trim() || "$29";
const PRO_PLAN_PERIOD =
  process.env.NEXT_PUBLIC_PRO_PLAN_PERIOD?.trim() || "/month";

export const REARVY_PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For solo operators getting started with AI-powered business visibility.",
    ctaLabel: "Start Free",
    features: [
      "One workspace with core dashboards",
      "Chat with your business data",
      "Basic alerts and project templates",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: PRO_PLAN_PRICE,
    period: PRO_PLAN_PERIOD,
    description: "For growing teams that need more integrations, context, and faster decision-making.",
    ctaLabel: "Choose Pro",
    badge: "Most popular",
    paymentRequired: true,
    paymentMethods: ["UPI", "Card"],
    features: [
      "Everything in Free",
      "Multi-source business context",
      "Priority insights and recommendations",
      "Priority support",
    ],
  },
];

export function getPlanDefinition(plan?: string | null) {
  return REARVY_PLANS.find((entry) => entry.id === plan) ?? REARVY_PLANS[0];
}
