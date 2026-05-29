import { createHmac, randomUUID } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import type { BillingSource, PaidBillingPlan } from "./shared";

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

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    message?: string;
  };
};

type EthereumTransaction = {
  from?: string;
  to?: string;
  value?: string;
};

type EthereumReceipt = {
  status?: string;
  transactionHash?: string;
};

type BillingRecord = {
  provider?: string;
  plan?: string;
  verified?: boolean;
  user_id?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  amount?: number;
  currency?: string;
  email?: string | null;
  full_name?: string | null;
  created_at?: unknown;
};

const PRO_PAYMENT_WALLET = "0x870f9677c47227c09dddf13e8aba7ab54aad72fa";
const PAID_BILLING_PLANS = new Set<PaidBillingPlan>(["pro", "business"]);

function normalizePaidBillingPlan(value: unknown): PaidBillingPlan {
  return value === "business" ? "business" : "pro";
}

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

function getMetaMaskPaymentRpcUrl() {
  return (
    readEnv("METAMASK_PAYMENT_RPC_URL") ||
    readEnv("ETHEREUM_RPC_URL") ||
    "https://cloudflare-eth.com"
  );
}

async function ethereumRpc<T>(method: string, params: unknown[]) {
  const response = await fetch(getMetaMaskPaymentRpcUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Ethereum RPC request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as JsonRpcResponse<T>;
  if (payload.error) {
    throw new Error(payload.error.message || "Ethereum RPC request failed.");
  }

  return payload.result ?? null;
}

async function verifyMetaMaskPaymentOnChain(input: {
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  valueWei: string;
}) {
  const [transaction, receipt] = await Promise.all([
    ethereumRpc<EthereumTransaction>("eth_getTransactionByHash", [
      input.transactionHash,
    ]),
    ethereumRpc<EthereumReceipt>("eth_getTransactionReceipt", [
      input.transactionHash,
    ]),
  ]);

  if (!transaction || !receipt) {
    throw new Error("MetaMask transaction is not confirmed on the configured RPC network yet.");
  }

  if (receipt.status !== "0x1") {
    throw new Error("MetaMask transaction failed on-chain.");
  }

  const fromAddress = transaction.from?.toLowerCase();
  const toAddress = transaction.to?.toLowerCase();
  const valueWei =
    typeof transaction.value === "string" ? BigInt(transaction.value).toString() : "";

  if (fromAddress !== input.fromAddress.toLowerCase()) {
    throw new Error("MetaMask payment sender does not match the connected wallet.");
  }

  if (toAddress !== input.toAddress.toLowerCase()) {
    throw new Error("MetaMask payment was not sent to the Rearvy payment wallet.");
  }

  if (valueWei !== input.valueWei) {
    throw new Error("MetaMask payment amount does not match the verified transaction.");
  }
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

export async function recordMetaMaskProPayment(input: {
  plan?: PaidBillingPlan | null;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  valueWei: string;
  chainId?: string | null;
  userId: string;
  email?: string | null;
}) {
  const plan = normalizePaidBillingPlan(input.plan);
  const transactionHash = input.transactionHash.trim();
  const fromAddress = input.fromAddress.trim();
  const toAddress = input.toAddress.trim().toLowerCase();
  const valueWei = input.valueWei.trim();

  if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
    throw new Error("Invalid MetaMask transaction hash.");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(fromAddress)) {
    throw new Error("Invalid MetaMask sender address.");
  }

  if (toAddress !== PRO_PAYMENT_WALLET) {
    throw new Error("MetaMask payment was not sent to the Rearvy payment wallet.");
  }

  if (!/^[0-9]+$/.test(valueWei) || BigInt(valueWei) <= BigInt(0)) {
    throw new Error("MetaMask payment must send a positive amount.");
  }

  await verifyMetaMaskPaymentOnChain({
    transactionHash,
    fromAddress,
    toAddress,
    valueWei,
  });

  const billingRef = adminDb.collection(BILLING_COLLECTION).doc(transactionHash);

  await adminDb.runTransaction(async (transaction) => {
    const billingSnap = await transaction.get(billingRef);
    const existing = billingSnap.exists ? (billingSnap.data() as BillingRecord) : null;

    if (existing?.user_id && existing.user_id !== input.userId) {
      throw new Error("This MetaMask payment has already been used by another account.");
    }

    transaction.set(
      billingRef,
      {
        provider: "metamask",
        plan,
        source: "settings",
        order_id: transactionHash,
        payment_id: transactionHash,
        transaction_hash: transactionHash,
        from_address: fromAddress,
        to_address: toAddress,
        chain_id: input.chainId || null,
        value_wei: valueWei,
        amount: Number(valueWei),
        currency: "ETH",
        order_status: "paid",
        payment_status: "captured",
        payment_method: "metamask",
        payment_method_label: "MetaMask",
        verified: true,
        user_id: input.userId,
        email: input.email?.trim() || null,
        signature_verified_at: new Date(),
        linked_at: new Date(),
        created_at: existing ? existing.created_at || new Date() : new Date(),
        updated_at: new Date(),
      },
      { merge: true }
    );
  });

  return {
    verificationId: transactionHash,
    plan,
    orderId: transactionHash,
    paymentId: transactionHash,
    amount: Number(valueWei),
    currency: "ETH",
    amountLabel: "MetaMask payment",
    method: "MetaMask",
  };
}

export async function attachVerifiedProPaymentToUser(input: {
  verificationId: string;
  userId: string;
  email?: string | null;
}): Promise<PaidBillingPlan> {
  const verificationId = input.verificationId.trim();

  if (!verificationId) {
    throw new Error("Missing payment verification reference.");
  }

  let activatedPlan: PaidBillingPlan = "pro";

  await adminDb.runTransaction(async (transaction) => {
    const billingRef = adminDb.collection(BILLING_COLLECTION).doc(verificationId);
    const billingSnap = await transaction.get(billingRef);

    if (!billingSnap.exists) {
      throw new Error("Verified payment not found.");
    }

    const billing = billingSnap.data() as BillingRecord;

    if (!PAID_BILLING_PLANS.has(billing.plan as PaidBillingPlan)) {
      throw new Error("This payment is not valid for paid plan activation.");
    }
    activatedPlan = normalizePaidBillingPlan(billing.plan);

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

  return activatedPlan;
}
