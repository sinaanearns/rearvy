"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/components/auth-provider";

const REDIRECT_DELAY_MS = 4000;

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [countdown, setCountdown] = useState(Math.ceil(REDIRECT_DELAY_MS / 1000));

  const sessionId = searchParams.get("session_id") || searchParams.get("checkout_session_id") || "";

  // Validate and sanitise the `from` path — must start with / and never be an
  // external URL to prevent open-redirect attacks.
  const rawFrom = searchParams.get("from") ?? "";
  const returnPath =
    rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/chat/new";

  useEffect(() => {
    async function confirmPayment() {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        await fetch("/api/payments/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (err) {
        console.error("Payment confirmation error:", err);
      }
    }
    if (!authLoading && user) {
      void confirmPayment();
    }
  }, [user, authLoading, sessionId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timeout = window.setTimeout(() => {
      router.push(returnPath);
    }, REDIRECT_DELAY_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [router, returnPath]);

  function handleGoNow() {
    router.push(returnPath);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <RearvyLogo
            priority
            markSize={40}
            markClassName="h-10 w-10 rounded-[8px]"
            textClassName="text-2xl text-foreground"
          />
        </div>

        {/* Success icon */}
        <div className="flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/25">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" strokeWidth={1.5} />
          </span>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {"You're on Business!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your subscription has been activated. Welcome to the full Rearvy
            experience — advanced AI workflows, deeper automation, and unlimited
            connected tools are all yours.
          </p>
        </div>

        {/* Auto-redirect hint */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {countdown > 0 ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              <span>
                {"Returning you in "}
                <span className="font-semibold tabular-nums text-foreground">
                  {countdown}
                </span>
                {countdown === 1 ? " second" : " seconds"}
                {"…"}
              </span>
            </>
          ) : (
            <span>{"Redirecting…"}</span>
          )}
        </div>

        {/* CTA */}
        <Button
          id="payment-success-continue"
          type="button"
          className="w-full gap-2"
          onClick={handleGoNow}
        >
          Continue to Rearvy
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}

