"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, DatabaseZap, FileKey2, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";

const choices = [
  {
    id: "account",
    label: "Account access",
    icon: ShieldCheck,
    enabled: true,
    locked: true,
    why: "Needed to sign in, keep workspace ownership clear, and route account requests.",
    control: "Manage profile data and send account requests from your Rearvy account email.",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: FileKey2,
    enabled: true,
    locked: false,
    why: "Needed only when you connect services such as Google, Shopify, Meta, or GitHub.",
    control: "Disconnect inside Rearvy where available or revoke access in the provider settings.",
  },
  {
    id: "ai",
    label: "AI workflow context",
    icon: Bot,
    enabled: true,
    locked: false,
    why: "Needed for prompts, task context, drafts, reports, browser work, and automation results.",
    control: "Review critical AI outputs before relying on them or approving external actions.",
  },
  {
    id: "operations",
    label: "Reliability signals",
    icon: DatabaseZap,
    enabled: true,
    locked: false,
    why: "Needed for logs, abuse prevention, performance monitoring, and service stability.",
    control: "Retained only as needed for operations, security, compliance, and legitimate business purposes.",
  },
];

export function PrivacyChoiceLab() {
  const [enabledIds, setEnabledIds] = useState(() => new Set(choices.filter((choice) => choice.enabled).map((choice) => choice.id)));
  const activeChoices = useMemo(
    () => choices.filter((choice) => enabledIds.has(choice.id)),
    [enabledIds],
  );
  const optionalActive = activeChoices.filter((choice) => !choice.locked).length;
  const optionalTotal = choices.filter((choice) => !choice.locked).length;
  const postureScore = Math.max(35, 100 - optionalActive * 12);
  const postureLabel =
    optionalActive === 0 ? "Minimal" : optionalActive === optionalTotal ? "Fully connected" : "Balanced";

  function toggleChoice(id: string) {
    const choice = choices.find((item) => item.id === id);
    if (!choice || choice.locked) {
      return;
    }

    setEnabledIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section id="privacy-choice-lab" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="rounded-xl border border-white/12 bg-black/42 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Privacy choices</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              See what changes when data is connected
            </h2>
          </div>
          <div className="rounded-full border border-white/12 bg-white/7 px-4 py-2 text-sm font-semibold text-white/62">
            {postureLabel} posture
          </div>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="grid gap-3">
            {choices.map((choice) => {
              const Icon = choice.icon;
              const isEnabled = enabledIds.has(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => toggleChoice(choice.id)}
                  className={[
                    "flex min-h-20 items-center justify-between gap-4 rounded-xl border p-4 text-left transition",
                    isEnabled
                      ? "border-cyan-200/28 bg-cyan-200/10"
                      : "border-white/10 bg-white/5 hover:border-white/22 hover:bg-white/8",
                  ].join(" ")}
                  aria-pressed={isEnabled}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-black/24">
                      <Icon className="h-5 w-5 text-cyan-100" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{choice.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/48">
                        {choice.locked ? "Core account requirement" : isEnabled ? "Connected" : "Not connected"}
                      </span>
                    </span>
                  </span>
                  {isEnabled ? (
                    <ToggleRight className="h-6 w-6 shrink-0 text-emerald-200" aria-hidden />
                  ) : (
                    <ToggleLeft className="h-6 w-6 shrink-0 text-white/36" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/6 p-5">
            <div className="mb-5 rounded-lg border border-white/8 bg-black/24 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Exposure meter</p>
                  <p className="mt-1 text-sm font-semibold text-white">{optionalActive} of {optionalTotal} optional areas active</p>
                </div>
                <span className="font-mono text-2xl font-semibold text-cyan-100">{postureScore}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-200 via-cyan-200 to-amber-200 transition-all duration-300"
                  style={{ width: `${postureScore}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-white/46">
                Lower connection counts mean fewer optional data areas are active; core account access remains required for the service.
              </p>
            </div>

            <div className="grid gap-3">
              {activeChoices.map((choice) => (
                <article key={choice.id} className="rounded-lg border border-white/8 bg-black/22 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" aria-hidden />
                    <h3 className="text-sm font-bold text-white">{choice.label}</h3>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Why it exists</p>
                      <p className="mt-2 text-sm leading-6 text-white/64">{choice.why}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Control path</p>
                      <p className="mt-2 text-sm leading-6 text-white/64">{choice.control}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
