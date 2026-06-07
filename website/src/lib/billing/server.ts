import { createHmac, timingSafeEqual } from "crypto";
import { isRecord, readResponseJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import {
  DEFAULT_BUSINESS_PAYMENT_WEI,
  DEFAULT_METAMASK_PAYMENT_ADDRESS,
  normalizePaidBillingPlan,
  type BillingCheckoutSource,
  type PaidBillingPlan,
  type VerifiedProCheckout,
} from "@/lib/billing/shared";

const BILLING_PAYMENTS_COLLECTION = "billing_payments";
const DEFAULT_METAMASK_RPC_URL = "https://cloudflare-eth.com";

type CreateOrderParams = {
  email: string | null;
  fullName: string | null;
  source: BillingCheckoutSource;
};

type VerifyRazorpayParams = {
  orderId: string;
  paymentId: string;
  signature: string;
};

type RecordMetaMaskParams = {
  plan?: PaidBillingPlan;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  valueWei: string;
  chainId: string | null;
  userId: string;
  email: string | null;
};

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function isTransactionHash(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

function getConfiguredMetaMaskPaymentAddress() {
  return normalizeAddress(
    process.env.METAMASK_PAYMENT_ADDRESS ||
      process.env.NEXT_PUBLIC_METAMASK_PAYMENT_ADDRESS ||
      DEFAULT_METAMASK_PAYMENT_ADDRESS
  );
}

function getMinimumPaymentWei() {
  const value =
    process.env.BUSINESS_PLAN_PAYMENT_WEI ||
    process.env.METAMASK_BUSINESS_PAYMENT_WEI ||
    process.env.NEXT_PUBLIC_METAMASK_BUSINESS_PAYMENT_WEI ||
    process.env.NEXT_PUBLIC_BUSINESS_PAYMENT_WEI ||
    DEFAULT_BUSINESS_PAYMENT_WEI;
  try {
    const parsed = BigInt(value);
    return parsed > BigInt(0) ? parsed : BigInt(DEFAULT_BUSINESS_PAYMENT_WEI);
  } catch {
    return BigInt(DEFAULT_BUSINESS_PAYMENT_WEI);
  }
}

function toPositiveWei(value: string) {
  try {
    const parsed = BigInt(value);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeChainId(value: string | null) {
  return typeof value === "string" && /^0x[a-fA-F0-9]+$/.test(value)
    ? value.toLowerCase()
    : null;
}

async function fetchMetaMaskTransaction(transactionHash: string) {
  const rpcUrl = process.env.METAMASK_PAYMENT_RPC_URL || DEFAULT_METAMASK_RPC_URL;
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [transactionHash],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await readResponseJsonRecord(response);
  return isRecord(payload.result) ? payload.result : null;
}

export function isProBillingConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createProCheckoutOrder(params: CreateOrderParams) {
  const keyId = readRequiredEnv("RAZORPAY_KEY_ID");
  const keySecret = readRequiredEnv("RAZORPAY_KEY_SECRET");
  const amount = Number(process.env.REARVY_PRO_PRICE_INR_PAISE || "9900");
  const receipt = `rearvy_${Date.now()}`;

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt,
      notes: {
        email: params.email || "",
        full_name: params.fullName || "",
        source: params.source,
        plan: "pro",
      },
    }),
  });

  const payload = await readResponseJsonRecord(response);
  const error = isRecord(payload.error) ? payload.error : null;

  if (!response.ok || typeof payload?.id !== "string") {
    throw new Error(
      optionalString(error?.description) ||
        `Razorpay order creation failed (${response.status})`
    );
  }

  await adminDb.collection(BILLING_PAYMENTS_COLLECTION).doc(payload.id).set(
    {
      provider: "razorpay",
      order_id: payload.id,
      email: params.email,
      full_name: params.fullName,
      source: params.source,
      plan: "pro",
      status: "created",
      amount: typeof payload.amount === "number" ? payload.amount : amount,
      currency: typeof payload.currency === "string" ? payload.currency : "INR",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    keyId,
    orderId: payload.id,
    amount: typeof payload.amount === "number" ? payload.amount : amount,
    currency: typeof payload.currency === "string" ? payload.currency : "INR",
  };
}

export async function verifyProCheckoutPayment(
  params: VerifyRazorpayParams
): Promise<VerifiedProCheckout & { orderId: string; paymentId: string }> {
  const keySecret = readRequiredEnv("RAZORPAY_KEY_SECRET");
  if (!params.orderId || !params.paymentId || !params.signature) {
    throw new Error("Missing Razorpay payment verification fields");
  }

  const expected = createHmac("sha256", keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  if (!safeCompare(params.signature, expected)) {
    throw new Error("Invalid Razorpay payment signature");
  }

  await adminDb.collection(BILLING_PAYMENTS_COLLECTION).doc(params.orderId).set(
    {
      provider: "razorpay",
      order_id: params.orderId,
      payment_id: params.paymentId,
      status: "verified",
      plan: "pro",
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    success: true,
    plan: "pro",
    verificationId: params.orderId,
    orderId: params.orderId,
    paymentId: params.paymentId,
  };
}

export async function recordMetaMaskProPayment(
  params: RecordMetaMaskParams
): Promise<VerifiedProCheckout & { transactionHash: string }> {
  const transactionHash = params.transactionHash.trim();
  const fromAddress = normalizeAddress(params.fromAddress);
  const toAddress = normalizeAddress(params.toAddress);
  const valueWei = toPositiveWei(params.valueWei);
  const expectedToAddress = getConfiguredMetaMaskPaymentAddress();

  if (!isTransactionHash(transactionHash)) {
    throw new Error("Invalid MetaMask transaction hash");
  }
  if (!isHexAddress(fromAddress) || !isHexAddress(toAddress)) {
    throw new Error("Invalid MetaMask wallet address");
  }
  if (toAddress !== expectedToAddress) {
    throw new Error("MetaMask payment was sent to the wrong address");
  }
  if (!valueWei || valueWei < getMinimumPaymentWei()) {
    throw new Error("MetaMask payment amount is below the required plan price");
  }

  const chainId = normalizeChainId(params.chainId);
  const transaction = await fetchMetaMaskTransaction(transactionHash);
  if (transaction) {
    const txFrom = optionalString(transaction.from);
    const txTo = optionalString(transaction.to);
    const txValue = (() => {
      if (typeof transaction.value !== "string") {
        return null;
      }

      try {
        return toPositiveWei(BigInt(transaction.value).toString());
      } catch {
        return null;
      }
    })();

    if (txFrom && normalizeAddress(txFrom) !== fromAddress) {
      throw new Error("MetaMask transaction sender does not match");
    }
    if (txTo && normalizeAddress(txTo) !== toAddress) {
      throw new Error("MetaMask transaction recipient does not match");
    }
    if (txValue && txValue < getMinimumPaymentWei()) {
      throw new Error("MetaMask transaction value is below the required plan price");
    }
  }

  const plan = normalizePaidBillingPlan(params.plan);
  await adminDb.collection(BILLING_PAYMENTS_COLLECTION).doc(transactionHash).set(
    {
      provider: "metamask",
      transaction_hash: transactionHash,
      user_id: params.userId,
      email: params.email || null,
      from_address: fromAddress,
      to_address: toAddress,
      value_wei: valueWei.toString(),
      chain_id: chainId,
      plan,
      status: "verified",
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    success: true,
    plan,
    verificationId: transactionHash,
    transactionHash,
  };
}

export async function attachVerifiedProPaymentToUser(params: {
  verificationId: string;
  userId: string;
  email: string | null;
}) {
  const verificationId = params.verificationId.trim();
  if (!verificationId) {
    throw new Error("Missing payment verification reference");
  }

  const paymentRef = adminDb
    .collection(BILLING_PAYMENTS_COLLECTION)
    .doc(verificationId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    throw new Error("Payment verification was not found");
  }

  const payment = paymentSnap.data() || {};
  if (payment.status !== "verified") {
    throw new Error("Payment has not been verified");
  }

  const paymentUserId = optionalString(payment.user_id);
  const paymentEmail = optionalString(payment.email);
  if (paymentUserId && paymentUserId !== params.userId) {
    throw new Error("Payment belongs to a different account");
  }
  if (paymentEmail && params.email && paymentEmail !== params.email) {
    throw new Error("Payment does not match authenticated user email");
  }

  const plan = normalizePaidBillingPlan(payment.plan);
  await paymentRef.set(
    {
      user_id: params.userId,
      email: params.email || paymentEmail || null,
      status: "activated",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );

  return plan;
}
