"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Monitor, ShieldCheck, Wifi } from "lucide-react";
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
    <main className="relative grid min-h-screen overflow-hidden bg-[#030405] px-5 py-8 text-white selection:bg-[#69d7ff] selection:text-black">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(116deg,rgba(105,215,255,0.18),transparent_32%),linear-gradient(248deg,rgba(125,231,199,0.13),transparent_36%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_82px),repeating-linear-gradient(0deg,rgba(255,255,255,0.02)_0_1px,transparent_1px_82px)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_76%_20%,rgba(247,201,72,0.15),transparent_31%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.86))]"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[1100px] items-center gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(360px,0.5fr)]">
        <section className="min-w-0">
          <Link href="/" aria-label="Rearvy home" className="inline-flex items-center gap-3">
            <Image src="/rearvy-logo.png" alt="Rearvy" width={38} height={38} priority />
            <span className="text-sm font-semibold tracking-wide text-white/78">Rearvy</span>
          </Link>

          <div className="mt-10 inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/[0.07] px-3 py-1 text-xs font-medium text-white/68 backdrop-blur-xl">
            <Monitor className="h-3.5 w-3.5 text-[#69d7ff]" aria-hidden />
            Desktop handoff
          </div>

          <h1 className="mt-5 max-w-3xl text-balance text-[clamp(42px,7vw,88px)] font-semibold leading-[0.92] tracking-normal">
            Signing in to Rearvy Desktop.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            Keep the desktop app open while this browser session sends a secure sign-in
            token back to the native window.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Browser session", icon: Wifi },
              { label: "Secure token", icon: ShieldCheck },
              { label: "Desktop app", icon: Monitor },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="grid min-h-[74px] place-items-center rounded-[8px] border border-white/12 bg-white/[0.06] p-4 text-center backdrop-blur-xl"
                >
                  <Icon className="h-5 w-5 text-[#69d7ff]" aria-hidden />
                  <p className="mt-2 text-xs font-medium text-white/60">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[8px] border border-white/12 bg-black/48 p-5 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] border border-[#69d7ff]/24 bg-[#69d7ff]/12 text-[#69d7ff]">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-white/52">
                Auth bridge
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Completing handoff</h2>
              <p className="mt-3 text-sm leading-6 text-white/62">
                This page will redirect automatically when the desktop auth token is ready.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-[8px] border border-red-300/24 bg-red-300/10 p-4 text-sm leading-6 text-red-50">
              {error}
            </div>
          ) : (
            <div className="mt-5 rounded-[8px] border border-white/10 bg-white/[0.055] p-4">
              <div className="flex items-center gap-3 text-sm font-semibold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-[#7de7c7] shadow-[0_0_16px_rgba(125,231,199,0.9)]" />
                Waiting for desktop callback
              </div>
            </div>
          )}

          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/24 px-5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
          >
            Return to login
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
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
