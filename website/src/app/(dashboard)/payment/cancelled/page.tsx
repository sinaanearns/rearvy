"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XCircle, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { Button } from "@/components/ui/button";

function CancelledContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The page the user was on before checkout — so we can go back there.
  const rawFrom = searchParams.get("from") ?? "";
  const returnPath =
    rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/chat/new";

  function handleGoBack() {
    router.push(returnPath);
  }

  function handleRetry() {
    // Navigate to the checkout loading page with the same returnPath
    router.push(`/payment/checkout?from=${encodeURIComponent(returnPath)}`);
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

        {/* Icon */}
        <div className="flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/25">
            <XCircle className="h-10 w-10 text-orange-500" strokeWidth={1.5} />
          </span>
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Payment cancelled
          </h1>
          <p className="text-sm text-muted-foreground">
            No worries — you have not been charged. You can upgrade anytime
            from the Rearvy sidebar, or go back to where you left off.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            id="cancelled-retry"
            type="button"
            className="gap-2"
            onClick={handleRetry}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
          <Button
            id="cancelled-go-back"
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleGoBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Rearvy
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CancelledContent />
    </Suspense>
  );
}

