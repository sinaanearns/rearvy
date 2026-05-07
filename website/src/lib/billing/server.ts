import { createHmac, randomUUID } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import type { BillingSource } from "./shared";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const BILLING_COLLECTION = "billing_payments";

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  amount_paid: number;
  amount_due: number;
  notes?: Record<string, string>;
};

type RazorpayPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method?: string;
  vpa?: string | null;
  wallet?: string | null;
  bank?: string | null;
  card?: {
    network?: string | null;
    type?: string | null;
  } | null;
};

type BillingRecord = {
  plan?: string;
  verified?: boolean;
  user_id?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  amount?: number;
  currency?: string;
  email?: string | null;
  full_name?: string | null;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function getRequiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getRazorpayKeyId() {
  return getRequiredEnv("RAZORPAY_KEY_ID");
}

function getRazorpayKeySecret() {
  return getRequiredEnv("RAZORPAY_KEY_SECRET");
}

function getProPlanAmount() {
  const rawValue = getRequiredEnv("RAZORPAY_PRO_PLAN_AMOUNT");
  const amount = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "RAZORPAY_PRO_PLAN_AMOUNT must be a positive integer in currency subunits."
    );
  }

  return amount;
}

function getProPlanCurrency() {
  return readEnv("RAZORPAY_PRO_PLAN_CURRENCY").toUpperCase() || "INR";
}

function getProPlanDescription() {
  return readEnv("RAZORPAY_PRO_PLAN_DESCRIPTION") || "Rearvy Pro monthly plan";
}

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

function toAuthHeader() {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  const encoded = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${encoded}`;
}

async function razorpayRequest<T>(
  path: string,
  init: {
    method: "GET" | "POST";
    body?: unknown;
  }
) {
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: toAuthHeader(),
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Razorpay request failed with status ${response.status}: ${errorText.slice(0, 200)}`
    );
  }

  return (await response.json()) as T;
}

function truncate(value?: string | null, maxLength = 120) {
  if (!value) {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function getPaymentMethodLabel(payment: RazorpayPayment) {
  if (payment.method === "upi") {
    return payment.vpa ? `UPI (${payment.vpa})` : "UPI";
  }

  if (payment.method === "card") {
    return payment.card?.network || "Card";
  }

  if (payment.method === "netbanking" && payment.bank) {
    return `Netbanking (${payment.bank})`;
  }

  if (payment.method === "wallet" && payment.wallet) {
    return `Wallet (${payment.wallet})`;
  }

  return payment.method || "payment";
}

export function isProBillingConfigured() {
  return Boolean(
    readEnv("RAZORPAY_KEY_ID") &&
      readEnv("RAZORPAY_KEY_SECRET") &&
      readEnv("RAZORPAY_PRO_PLAN_AMOUNT")
  );
}

export async function createProCheckoutOrder(input: {
  email?: string | null;
  fullName?: string | null;
  source: BillingSource;
}) {
  const amount = getProPlanAmount();
  const currency = getProPlanCurrency();
  const receipt = `rearvy_${input.source}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

  const order = await razorpayRequest<RazorpayOrder>("/orders", {
    method: "POST",
    body: {
      amount,
      currency,
      receipt,
      notes: {
        plan: "pro",
        source: input.source,
        email: truncate(input.email),
        full_name: truncate(input.fullName),
      },
    },
  });

  await adminDb.collection(BILLING_COLLECTION).doc(order.id).set(
    {
      provider: "razorpay",
      plan: "pro",
      source: input.source,
      order_id: order.id,
      receipt: order.receipt,
      amount: order.amount,
      currency: order.currency,
      order_status: order.status,
      email: input.email?.trim() || null,
      full_name: input.fullName?.trim() || null,
      verified: false,
      user_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    { merge: true }
  );

  return {
    keyId: getRazorpayKeyId(),
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    amountLabel: formatAmount(order.amount, order.currency),
    description: getProPlanDescription(),
  };
}

export async function verifyProCheckoutPayment(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const orderId = input.orderId.trim();
  const paymentId = input.paymentId.trim();
  const signature = input.signature.trim();

  if (!orderId || !paymentId || !signature) {
    throw new Error("Missing payment verification details.");
  }

  const billingRef = adminDb.collection(BILLING_COLLECTION).doc(orderId);
  const billingSnap = await billingRef.get();

  if (!billingSnap.exists) {
    throw new Error("Billing order not found.");
  }

  const expectedSignature = createHmac("sha256", getRazorpayKeySecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new Error("Payment signature verification failed.");
  }

  const [order, payment] = await Promise.all([
    razorpayRequest<RazorpayOrder>(`/orders/${orderId}`, { method: "GET" }),
    razorpayRequest<RazorpayPayment>(`/payments/${paymentId}`, {
      method: "GET",
    }),
  ]);

  if (payment.order_id !== orderId) {
    throw new Error("Payment order mismatch.");
  }

  if (order.status !== "paid") {
    throw new Error("Payment has not reached the paid state yet. Please try again.");
  }

  if (payment.status !== "captured") {
    throw new Error("Payment is not in a valid state for activation.");
  }

  await billingRef.set(
    {
      verified: true,
      payment_id: payment.id,
      payment_status: payment.status,
      payment_method: payment.method || null,
      payment_method_label: getPaymentMethodLabel(payment),
      order_status: order.status,
      signature_verified_at: new Date(),
      updated_at: new Date(),
    },
    { merge: true }
  );

  return {
    verificationId: orderId,
    orderId,
    paymentId: payment.id,
    amount: order.amount,
    currency: order.currency,
    amountLabel: formatAmount(order.amount, order.currency),
    method: getPaymentMethodLabel(payment),
  };
}

export async function attachVerifiedProPaymentToUser(input: {
  verificationId: string;
  userId: string;
  email?: string | null;
}) {
  const verificationId = input.verificationId.trim();

  if (!verificationId) {
    throw new Error("Missing payment verification reference.");
  }

  await adminDb.runTransaction(async (transaction) => {
    const billingRef = adminDb.collection(BILLING_COLLECTION).doc(verificationId);
    const billingSnap = await transaction.get(billingRef);

    if (!billingSnap.exists) {
      throw new Error("Verified payment not found.");
    }

    const billing = billingSnap.data() as BillingRecord;

    if (billing.plan !== "pro") {
      throw new Error("This payment is not valid for Pro activation.");
    }

    if (!billing.verified) {
      throw new Error("Payment has not been verified yet.");
    }

    if (billing.order_status !== "paid") {
      throw new Error("Payment order is not marked as paid.");
    }

    if (billing.payment_status !== "captured") {
      throw new Error("Payment is not ready for activation.");
    }

    if (billing.user_id && billing.user_id !== input.userId) {
      throw new Error("This payment has already been used by another account.");
    }

    transaction.set(
      billingRef,
      {
        user_id: input.userId,
        email: input.email?.trim() || billing.email || null,
        linked_at: new Date(),
        updated_at: new Date(),
      },
      { merge: true }
    );
  });
}
