"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { Button } from "@/components/ui/button";
import { getIdToken } from "@/lib/firebase/auth";

type CheckoutState = "loading" | "redirecting" | "error";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<CheckoutState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const started = useRef(false);

  // Validate the from path to prevent open-redirect
  const rawFrom = searchParams.get("from") ?? "";
  const returnPath =
    rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/chat/new";

  useEffect(() => {
    // Guard: only run once even in React Strict Mode double-invoke
    if (started.current) return;
    started.current = true;

    async function initiateCheckout() {
      try {
        // Short delay so the user sees the branded loading screen (not a jarring flash)
        await new Promise((r) => setTimeout(r, 800));

        const token = await getIdToken();
        const res = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ returnPath }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || `Checkout failed (${res.status})`);
        }

        const url = data.checkout_url as string | undefined;
        if (!url) throw new Error("No checkout URL returned.");

        setState("redirecting");
        // Small delay before hard-redirecting so the "Redirecting…" text shows
        await new Promise((r) => setTimeout(r, 400));
        window.location.assign(url);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
        setState("error");
      }
    }

    void initiateCheckout();
  }, [returnPath]);

  if (state === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <RearvyLogo
              priority
              markSize={40}
              markClassName="h-10 w-10 rounded-[8px]"
              textClassName="text-2xl text-foreground"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              {errorMsg ?? "We could not start your checkout. Please try again."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              id="checkout-retry"
              type="button"
              onClick={() => {
                started.current = false;
                setState("loading");
                setErrorMsg(null);
              }}
            >
              Try again
            </Button>
            <Button
              id="checkout-go-back"
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
            >
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-full max-w-md space-y-10">
        {/* Logo */}
        <div className="flex justify-center">
          <RearvyLogo
            priority
            markSize={40}
            markClassName="h-10 w-10 rounded-[8px]"
            textClassName="text-2xl text-foreground"
          />
        </div>

        {/* Spinner */}
        <div className="flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
          </span>
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {state === "redirecting"
              ? "Redirecting to checkout…"
              : "Preparing your checkout"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {state === "redirecting"
              ? "You are being taken to our secure payment page."
              : "Please wait while we set up your secure checkout session."}
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
          <span>Secure checkout powered by Dodo Payments</span>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

