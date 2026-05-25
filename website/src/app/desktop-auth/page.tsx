"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

function normalizeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/chat";
  }

  return value;
}

function DesktopAuthBridge() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const redirect = useMemo(
    () => normalizeRedirect(searchParams.get("redirect")),
    [searchParams]
  );

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      const desktopAuthRedirect = `/desktop-auth?redirect=${encodeURIComponent(redirect)}`;
      router.replace(
        `/login?redirect=${encodeURIComponent(desktopAuthRedirect)}`
      );
      return;
    }

    let cancelled = false;

    const completeDesktopSignIn = async () => {
      try {
        const idToken = await user.getIdToken(true);
        const response = await fetch("/api/desktop/auth/exchange", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        const payload = (await response.json().catch(() => ({}))) as {
          customToken?: string;
          error?: string;
        };

        if (!response.ok || !payload.customToken) {
          throw new Error(payload.error || "Unable to create desktop sign-in token.");
        }

        if (cancelled) {
          return;
        }

        const callback = new URL("rearvy://auth-callback");
        callback.searchParams.set("token", payload.customToken);
        callback.searchParams.set("redirect", redirect);
        window.location.href = callback.toString();
      } catch (authError) {
        if (!cancelled) {
          setError(
            authError instanceof Error
              ? authError.message
              : "Unable to complete desktop sign-in."
          );
        }
      }
    };

    void completeDesktopSignIn();

    return () => {
      cancelled = true;
    };
  }, [loading, redirect, router, user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <h1 className="text-xl font-semibold">Signing in to Rearvy Desktop</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep the desktop app open. This browser window will hand your active
          Rearvy session back to the app.
        </p>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense>
      <DesktopAuthBridge />
    </Suspense>
  );
}
