"use client";

import type {
  BillingSource,
  PaidBillingPlan,
  VerifiedProPayment,
} from "./shared";

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    description?: string;
  };
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    confirm_close?: boolean;
    ondismiss?: () => void;
  };
  config?: {
    display?: {
      blocks?: Record<
        string,
        {
          name: string;
          instruments: Array<{ method: string }>;
        }
      >;
      sequence?: string[];
      preferences?: {
        show_default_blocks?: boolean;
      };
    };
  };
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (
    eventName: "payment.failed",
    callback: (response: RazorpayFailureResponse) => void
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

const PRO_PAYMENT_WALLET = "0x870f9677c47227C09dDDf13E8AbA7AB54AaD72fA";
const PAID_PLAN_PAYMENTS: Record<
  PaidBillingPlan,
  { label: string; usdAmount: number; fallbackEthAmount: number }
> = {
  pro: {
    label: "Pro",
    usdAmount: 29,
    fallbackEthAmount: 0.01,
  },
  business: {
    label: "Business",
    usdAmount: 99,
    fallbackEthAmount: 0.034,
  },
};

type MetaMaskProvider = {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<unknown>;
};

async function readErrorResponse(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ethToWeiHex(ethAmount: number) {
  const wei = BigInt(Math.ceil(ethAmount * 1e18));
  return `0x${wei.toString(16)}`;
}

async function getPlanPaymentEthAmount(plan: PaidBillingPlan) {
  const planPayment = PAID_PLAN_PAYMENTS[plan];

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error("ETH quote unavailable.");
    }

    const payload = (await response.json()) as {
      ethereum?: { usd?: number };
    };
    const usd = payload.ethereum?.usd;
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
      throw new Error("Invalid ETH quote.");
    }

    return planPayment.usdAmount / usd;
  } catch {
    return planPayment.fallbackEthAmount;
  }
}

async function waitForMetaMaskReceipt(transactionHash: string) {
  const ethereum = (window as Window & { ethereum?: MetaMaskProvider }).ethereum;
  if (!ethereum) {
    throw new Error("MetaMask is not available.");
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const receipt = (await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    })) as Record<string, unknown> | null;

    if (receipt) {
      if (receipt.status !== "0x1") {
        throw new Error("MetaMask transaction did not complete successfully.");
      }
      return receipt;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("MetaMask transaction is still pending. Try again after it confirms.");
}

export async function startProCheckout(input: {
  email?: string | null;
  fullName?: string | null;
  source: BillingSource;
  plan?: PaidBillingPlan;
}) {
  const plan = input.plan || "pro";
  const planPayment = PAID_PLAN_PAYMENTS[plan];

  const ethereum = typeof window === "undefined"
    ? null
    : (window as Window & { ethereum?: MetaMaskProvider }).ethereum;

  if (!ethereum) {
    throw new Error("MetaMask is required for checkout right now.");
  }

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as unknown;

  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
    throw new Error("MetaMask did not return a wallet account.");
  }

  const fromAddress = accounts[0];
  const ethAmount = await getPlanPaymentEthAmount(plan);
  const value = ethToWeiHex(ethAmount);
  const chainId = (await ethereum.request({ method: "eth_chainId" })) as unknown;
  const transactionHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: fromAddress,
        to: PRO_PAYMENT_WALLET,
        value,
      },
    ],
  })) as unknown;

  if (typeof transactionHash !== "string" || !transactionHash.startsWith("0x")) {
    throw new Error("MetaMask did not return a transaction hash.");
  }

  await waitForMetaMaskReceipt(transactionHash);

  const verifyResponse = await fetch("/api/billing/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "metamask",
      plan,
      transactionHash,
      fromAddress,
      toAddress: PRO_PAYMENT_WALLET,
      valueWei: BigInt(value).toString(),
      chainId: typeof chainId === "string" ? chainId : null,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error(
      await readErrorResponse(
        verifyResponse,
        `${planPayment.label} payment succeeded but could not be verified.`
      )
    );
  }

  return (await verifyResponse.json()) as VerifiedProPayment;
}
