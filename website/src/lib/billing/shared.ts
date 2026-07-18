export type PaidBillingPlan = "pro" | "business";

export function normalizePaidBillingPlan(plan: unknown): PaidBillingPlan {
  return plan === "business" ? "business" : "pro";
}
