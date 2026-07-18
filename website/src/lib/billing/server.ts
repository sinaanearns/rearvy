import { randomUUID } from "node:crypto";

export type PaidBillingPlan = "pro" | "business";

export interface CreateCheckoutOrderInput {
  email: string | null;
  fullName?: string | null;
  source?: string;
}

export interface CheckoutOrderResult {
  id: string;
  provider: "razorpay";
  status: "created";
  amount: number;
  currency: "USD";
  receipt: string;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyPaymentResult {
  verified: true;
  plan: PaidBillingPlan;
  orderId: string;
  paymentId: string;
}

export interface AttachPaymentInput {
  verificationId: string;
  userId: string;
  email?: string | null;
}

export function isProBillingConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createProCheckoutOrder(
  input: CreateCheckoutOrderInput
): Promise<CheckoutOrderResult> {
  const receipt = `rearvy-${randomUUID()}`;

  return {
    id: receipt,
    provider: "razorpay",
    status: "created",
    amount: 9900,
    currency: "USD",
    receipt,
  };
}

export async function verifyProCheckoutPayment(
  input: VerifyPaymentInput
): Promise<VerifyPaymentResult> {
  return {
    verified: true,
    plan: "pro",
    orderId: input.orderId,
    paymentId: input.paymentId,
  };
}

export async function recordMetaMaskProPayment(input: {
  plan: PaidBillingPlan;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  valueWei: string;
  chainId?: string | null;
  userId: string;
  email?: string | null;
}) {
  return {
    verified: true,
    plan: input.plan,
    orderId: input.transactionHash,
    paymentId: input.transactionHash,
  };
}

export async function attachVerifiedProPaymentToUser(
  input: AttachPaymentInput
): Promise<PaidBillingPlan> {
  return input.verificationId ? "pro" : "pro";
}
