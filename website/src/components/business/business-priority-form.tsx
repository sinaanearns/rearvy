"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Mail, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type SubmitState = { ok: boolean; message: string };

export type BusinessPriorityFormProps = {
  afterSubmitRedirect?: string | null;
  onSuccess?: () => void;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
};

export function BusinessPriorityForm({
  afterSubmitRedirect = "/business/signup",
  onSuccess,
  className,
  title,
  description,
}: BusinessPriorityFormProps) {
  const [businessName, setBusinessName] = useState("");
  const [gmail, setGmail] = useState("");
  const [about, setAbout] = useState("");
  const [hopes, setHopes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSubmitState(null);

    const plannedUse = [
      "Business details for priority onboarding",
      `About: ${about || "-"}`,
      `What we hope for from Rearvy: ${hopes || "-"}`,
    ].join("\n");

    try {
      const res = await fetch("/api/business-freemium-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          gmail,
          plannedUse,
          about,
          hopes,
        }),
      });

      const payload = (await res.json().catch(() => null)) as unknown as { error?: string };
      if (!res.ok) {
        throw new Error(payload?.error || "Unable to submit registration.");
      }

      setSubmitState({
        ok: true,
        message:
          "Request submitted. Unlocking your business dashboard...",
      });

      onSuccess?.();

      if (afterSubmitRedirect) {
        setTimeout(() => {
          window.location.href = afterSubmitRedirect;
        }, 1400);
      }
    } catch (err) {
      setSubmitState({
        ok: false,
        message: err instanceof Error ? err.message : "Unable to submit registration.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={["rounded-[8px] border border-white/12 bg-black/48 p-6 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-8", className || ""].join(" ")}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-cyan-200/24 bg-cyan-200/10 text-cyan-100">
          <Pencil className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {title ?? "Tell us about your business"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/68">
            {description ?? "Businesses are prioritized. Use a Gmail address so we can contact you."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="businessName" className="inline-flex items-center gap-2 text-white/90">
            <Building2 className="h-3.5 w-3.5 text-slate-300" />
            Business name
          </Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Acme Inc."
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="gmail" className="inline-flex items-center gap-2 text-white/90">
            <Mail className="h-3.5 w-3.5 text-slate-300" />
            Gmail (required)
          </Label>
          <Input
            id="gmail"
            type="email"
            inputMode="email"
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
            placeholder="you@gmail.com"
            required
          />
          <p className="text-xs text-white/55">Note: Only @gmail.com addresses are accepted for this form.</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="about" className="text-white/90">What is the business about?</Label>
          <Textarea
            id="about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Describe what your business does, audience, and primary offering."
            rows={4}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="hopes" className="text-white/90">What are you hoping for from Rearvy?</Label>
          <Textarea
            id="hopes"
            value={hopes}
            onChange={(e) => setHopes(e.target.value)}
            placeholder="Explain what outcomes or improvements you expect with Rearvy."
            rows={3}
          />
        </div>

        {submitState ? (
          <div
            className={[
              "rounded-[8px] border p-3 text-sm",
              submitState.ok
                ? "border-emerald-300/24 bg-emerald-300/10 text-emerald-50"
                : "border-red-300/24 bg-red-300/10 text-red-50",
            ].join(" ")}
          >
            {submitState.message}
          </div>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-3">
          <Button type="submit" disabled={loading} className="min-h-11">
            {loading ? "Submitting..." : "Submit registration"}
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/24 px-5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
          >
            Cancel
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </form>
    </div>
  );
}

export default BusinessPriorityForm;