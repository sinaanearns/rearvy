export type BillingSource = "signup" | "settings";

export type CreateProCheckoutRequest = {
  email?: string | null;
  fullName?: string | null;
  source: BillingSource;
};

export type CreateProCheckoutResponse = {
  provider: "razorpay";
  plan: "pro";
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  amountLabel: string;
  description: string;
};

export type VerifyProCheckoutRequest = {
  orderId: string;
  paymentId: string;
  signature: string;
};

export type VerifiedProPayment = {
  provider: "razorpay";
  plan: "pro";
  verificationId: string;
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  amountLabel: string;
  method: string;
};
