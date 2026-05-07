"use client";

import type {
  BillingSource,
  CreateProCheckoutResponse,
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

const SCRIPT_ID = "rearvy-razorpay-checkout";
const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

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

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Checkout is only available in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    return new Promise<void>((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load Razorpay checkout.")),
        { once: true }
      );
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });
}

export async function startProCheckout(input: {
  email?: string | null;
  fullName?: string | null;
  source: BillingSource;
}) {
  const createOrderResponse = await fetch("/api/billing/create-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email?.trim() || null,
      fullName: input.fullName?.trim() || null,
      source: input.source,
    }),
  });

  if (!createOrderResponse.ok) {
    throw new Error(
      await readErrorResponse(
        createOrderResponse,
        "Unable to start checkout for the Pro plan."
      )
    );
  }

  const checkoutConfig =
    (await createOrderResponse.json()) as CreateProCheckoutResponse;

  await loadRazorpayScript();

  if (!window.Razorpay) {
    throw new Error("Razorpay checkout did not load correctly.");
  }

  const Razorpay = window.Razorpay;

  return await new Promise<VerifiedProPayment>((resolve, reject) => {
    let settled = false;

    const resolveOnce = (payment: VerifiedProPayment) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(payment);
    };

    const rejectOnce = (message: string) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(message));
    };

    const checkout = new Razorpay({
      key: checkoutConfig.keyId,
      amount: checkoutConfig.amount,
      currency: checkoutConfig.currency,
      name: "Rearvy",
      description: checkoutConfig.description,
      order_id: checkoutConfig.orderId,
      prefill: {
        name: input.fullName?.trim() || undefined,
        email: input.email?.trim() || undefined,
      },
      theme: {
        color: "#111827",
      },
      config: {
        display: {
          blocks: {
            preferred: {
              name: "Pay with UPI or card",
              instruments: [{ method: "upi" }, { method: "card" }],
            },
          },
          sequence: ["block.preferred"],
          preferences: {
            show_default_blocks: true,
          },
        },
      },
      modal: {
        confirm_close: true,
        ondismiss: () => rejectOnce("Payment was cancelled before completion."),
      },
      handler: async (response) => {
        try {
          const verifyResponse = await fetch("/api/billing/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });

          if (!verifyResponse.ok) {
            throw new Error(
              await readErrorResponse(
                verifyResponse,
                "Payment succeeded but could not be verified."
              )
            );
          }

          const verifiedPayment =
            (await verifyResponse.json()) as VerifiedProPayment;
          resolveOnce(verifiedPayment);
        } catch (error) {
          rejectOnce(
            getErrorMessage(error, "Payment succeeded but verification failed.")
          );
        }
      },
    });

    checkout.on("payment.failed", (response) => {
      rejectOnce(
        response.error?.description || "Payment failed. Please try again."
      );
    });

    checkout.open();
  });
}
