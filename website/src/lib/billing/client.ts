"use client";

import { getIdToken } from "@/lib/firebase/auth";
import {
  DEFAULT_METAMASK_PAYMENT_ADDRESS,
  type CreateProCheckoutRequest,
  type VerifiedProCheckout,
} from "@/lib/billing/shared";
import { isRecord, readResponseJsonRecord } from "@/lib/api/request-body";

type EthereumProvider = {
  request: (args: {
    method: string;
    params?: Array<Record<string, unknown>> | unknown[];
  }) => Promise<unknown>;
};

type BillingWindow = Window & {
  ethereum?: EthereumProvider;
};

type VerifyMetaMaskPaymentPayload =
  | (VerifiedProCheckout & { error?: string })
  | { success: false; error?: string };

function parseVerifiedCheckout(value: unknown): VerifyMetaMaskPaymentPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.success !== true || typeof value.plan !== "string" || typeof value.verificationId !== "string") {
    return {
      success: false,
      error: typeof value.error === "string" ? value.error : undefined,
    };
  }

  return {
    success: true,
    plan: value.plan === "business" ? "business" : "pro",
    verificationId: value.verificationId,
    error: typeof value.error === "string" ? value.error : undefined,
  };
}

function getPaymentAddress() {
  return (
    process.env.NEXT_PUBLIC_METAMASK_PAYMENT_ADDRESS ||
    DEFAULT_METAMASK_PAYMENT_ADDRESS
  );
}

function getBusinessPaymentWei() {
  return (
    process.env.NEXT_PUBLIC_METAMASK_BUSINESS_PAYMENT_WEI ||
    process.env.NEXT_PUBLIC_BUSINESS_PAYMENT_WEI ||
    ""
  );
}

function normalizeHexAddress(value: string) {
  return value.trim().toLowerCase();
}

function decimalWeiToHex(valueWei: string) {
  try {
    const parsed = BigInt(valueWei);
    if (parsed <= BigInt(0)) {
      throw new Error("MetaMask payment amount must be greater than zero.");
    }
    return `0x${parsed.toString(16)}`;
  } catch (error) {
    if (error instanceof Error && error.message.includes("greater than zero")) {
      throw error;
    }
    throw new Error(
      "MetaMask checkout is missing NEXT_PUBLIC_METAMASK_BUSINESS_PAYMENT_WEI."
    );
  }
}

async function verifyMetaMaskPayment(params: {
  plan: "business" | "pro";
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  valueWei: string;
  chainId: string | null;
}): Promise<VerifiedProCheckout> {
  const token = await getIdToken();

  if (!token) {
    throw new Error("Sign in again before activating paid access.");
  }

  const response = await fetch("/api/billing/verify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "metamask",
      ...params,
    }),
  });

  const payload = parseVerifiedCheckout(await readResponseJsonRecord(response));

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "Could not verify MetaMask payment.");
  }

  return payload;
}

export async function startProCheckout(
  request: CreateProCheckoutRequest
): Promise<VerifiedProCheckout> {
  const browserWindow = window as BillingWindow;
  const provider = browserWindow.ethereum;
  if (!provider) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
    throw new Error("MetaMask did not return an account.");
  }

  const fromAddress = accounts[0];
  const toAddress = getPaymentAddress();
  const valueWei = getBusinessPaymentWei();
  const transactionHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: fromAddress,
        to: toAddress,
        value: decimalWeiToHex(valueWei),
      },
    ],
  });

  if (typeof transactionHash !== "string" || !transactionHash.trim()) {
    throw new Error("MetaMask did not return a transaction hash.");
  }

  const chainId = await provider.request({ method: "eth_chainId" });

  return verifyMetaMaskPayment({
    plan: request.plan === "business" ? "business" : "pro",
    transactionHash,
    fromAddress: normalizeHexAddress(fromAddress),
    toAddress: normalizeHexAddress(toAddress),
    valueWei,
    chainId: typeof chainId === "string" ? chainId : null,
  });
}
