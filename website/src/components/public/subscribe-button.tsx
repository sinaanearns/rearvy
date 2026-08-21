"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import { isElectron } from "@/lib/utils/env";
import { ArrowRight } from "lucide-react";

type Profile = {
  id: string;
  email: string | null;
  plan: "free" | "pro" | "business";
  credits?: number;
  currency?: string;
};

/** The production website URL to use when opening checkout from the desktop app. */
const WEBSITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://rearvy.com";

export function SubscribeButton({ className }: { className?: string }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [plan, setPlan] = useState<Profile["plan"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentsConfigured, setPaymentsConfigured] = useState<boolean | null>(null);

  // Load Dodo Payments config to decide whether to show the button
  useEffect(() => {
    let active = true;
    async function loadConfig() {
      try {
        const res = await fetch("/api/payments/config", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!active) return;
        setPaymentsConfigured(Boolean(data?.configured));
      } catch {
        if (active) setPaymentsConfigured(false);
      }
    }
    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!user) {
        setPlan(null);
        return;
      }
      try {
        const token = await getIdToken();
        const res = await fetch("/api/dashboard/profile", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
        const data = await res.json();
        const p = data.profile;
        if (active) setPlan((p?.plan as Profile["plan"]) ?? "free");
      } catch {
        if (active) setPlan("free");
      }
    }
    if (!loading) {
      void loadProfile();
    }
    return () => {
      active = false;
    };
  }, [user, loading]);

  if (loading) return null;
  if (paymentsConfigured === null) return null;
  if (paymentsConfigured === false) return null;
  if (!user) return null;
  if (plan && plan !== "free") return null;

  async function handleClick() {
    setBusy(true);
    setError(null);
    if (paymentsConfigured !== true) { setBusy(false); return; }

    try {
      const returnPath = pathname || "/chat/new";

      // ── Desktop (Electron) path ───────────────────────────────────────────
      // Open the system browser so the user goes through the full web checkout
      // experience on rearvy.com instead of inside the Electron shell.
      if (isElectron() && window.electron?.system?.openExternal) {
        const checkoutPageUrl =
          `${WEBSITE_URL}/payment/checkout?from=${encodeURIComponent(returnPath)}`;
        await window.electron.system.openExternal(checkoutPageUrl);
        setBusy(false);
        return;
      }

      // ── Web path ──────────────────────────────────────────────────────────
      // Call the checkout API and redirect in the current tab.
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
      if (!res.ok) throw new Error(data?.error || "Failed to start checkout");
      const url = data.checkout_url as string | undefined;
      if (!url) throw new Error("Missing checkout_url");
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className="flex w-full items-center gap-2 rounded-[8px] border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-2 text-left text-xs font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground disabled:opacity-60"
      >
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 truncate">
          {busy ? "Opening checkout…" : "Upgrade to Business"}
        </span>
      </button>
      {error ? <p className="mt-1 text-[10px] text-red-400">{error}</p> : null}
    </div>
  );
}