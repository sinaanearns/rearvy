import type { SubscriptionPlan } from "@/lib/plans";

export type PaidBillingPlan = Extract<SubscriptionPlan, "pro" | "business">;

export type BillingCheckoutSource = "settings" | "signup";

export type CreateProCheckoutRequest = {
  email?: string | null;
  fullName?: string | null;
  source?: BillingCheckoutSource;
  plan?: PaidBillingPlan;
};

export type RazorpayVerifyProCheckoutRequest = {
  provider?: "razorpay";
  orderId?: string;
  paymentId?: string;
  signature?: string;
};

export type MetaMaskVerifyProCheckoutRequest = {
  provider: "metamask";
  plan?: PaidBillingPlan;
  transactionHash?: string;
  fromAddress?: string;
  toAddress?: string;
  valueWei?: string;
  chainId?: string | null;
};

export type VerifyProCheckoutRequest =
  | RazorpayVerifyProCheckoutRequest
  | MetaMaskVerifyProCheckoutRequest;

export type VerifiedProCheckout = {
  success: true;
  plan: PaidBillingPlan;
  verificationId: string;
};

export type BillingVerification = {
  orderId: string;
  paymentId: string;
  plan: PaidBillingPlan;
  provider: "metamask" | "razorpay";
  verificationId: string;
};

export type ProCheckoutOrder = {
  amount: number;
  currency: string;
  description: string;
  keyId: string;
  orderId: string;
  plan: PaidBillingPlan;
  provider: "razorpay";
  receipt: string;
};

export const DEFAULT_METAMASK_PAYMENT_ADDRESS =
  "0x870f9677c47227C09dDDf13E8AbA7AB54AaD72fA";

export const DEFAULT_BUSINESS_PAYMENT_WEI = "1000000000000000";

export function normalizePaidBillingPlan(value: unknown): PaidBillingPlan {
  return value === "business" ? "business" : "pro";
}
