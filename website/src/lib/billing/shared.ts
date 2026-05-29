export type BillingSource = "signup" | "settings";
export type PaidBillingPlan = "pro" | "business";

export type CreateProCheckoutRequest = {
  email?: string | null;
  fullName?: string | null;
  source: BillingSource;
  plan?: PaidBillingPlan;
};

export type CreateProCheckoutResponse = {
  provider: "razorpay" | "metamask";
  plan: PaidBillingPlan;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  amountLabel: string;
  description: string;
};

export type VerifyProCheckoutRequest = {
  provider?: "razorpay" | "metamask";
  plan?: PaidBillingPlan;
  orderId?: string;
  paymentId?: string;
  signature?: string;
  transactionHash?: string;
  fromAddress?: string;
  toAddress?: string;
  valueWei?: string;
  chainId?: string;
};

export type VerifiedProPayment = {
  provider: "razorpay" | "metamask";
  plan: PaidBillingPlan;
  verificationId: string;
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  amountLabel: string;
  method: string;
};
