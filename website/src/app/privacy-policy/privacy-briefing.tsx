"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Code2, Fingerprint, ShieldCheck, UserRoundCheck } from "lucide-react";

const audiences = [
  {
    id: "owner",
    label: "Owner",
    icon: UserRoundCheck,
    headline: "Your account stays under your control.",
    summary:
      "See what connects, what can be removed, and how to ask Rearvy for access, correction, export, or deletion help.",
    signals: ["Deletion path", "Provider disconnects", "No personal data sales"],
    next: "#privacy-request-builder",
  },
  {
    id: "operator",
    label: "Operator",
    icon: BriefcaseBusiness,
    headline: "Workflow data is used to complete requested work.",
    summary:
      "Rearvy can process prompts, task context, files, and connected app data when that context is needed for the workflow you start.",
    signals: ["Scoped integrations", "Review-first AI outputs", "Operational safeguards"],
    next: "#privacy-operations",
  },
  {
    id: "developer",
    label: "Developer",
    icon: Code2,
    headline: "Integration access follows provider permission boundaries.",
    summary:
      "Connected services stay governed by their own scopes, provider settings, token handling, rate limits, and user revocation paths.",
    signals: ["Authorized scopes", "Sensitive token handling", "Provider-side controls"],
    next: "#privacy-integrations",
  },
];

const briefingStats = [
  { label: "Policy posture", value: "No-sale", icon: ShieldCheck },
  { label: "Control model", value: "User-led", icon: Fingerprint },
  { label: "AI stance", value: "Review", icon: CheckCircle2 },
];

export function PrivacyBriefing() {
  const [selectedId, setSelectedId] = useState(audiences[0].id);
  const selectedAudience = useMemo(
    () => audiences.find((audience) => audience.id === selectedId) ?? audiences[0],
    [selectedId],
  );
  const SelectedIcon = selectedAudience.icon;

  return (
    <section id="privacy-briefing" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-black/42 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-white/10 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
              Privacy briefing
            </p>
            <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-white">
              Read the policy from the role that matches your day.
            </h2>
            <div className="mt-5 grid gap-2">
              {audiences.map((audience) => {
                const Icon = audience.icon;
                const isSelected = audience.id === selectedId;

                return (
                  <button
                    key={audience.id}
                    type="button"
                    onClick={() => setSelectedId(audience.id)}
                    className={[
                      "flex min-h-14 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition",
                      isSelected
                        ? "border-cyan-200/38 bg-cyan-200/12 text-white shadow-[0_16px_45px_rgba(34,211,238,0.12)]"
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/22 hover:bg-white/8 hover:text-white",
                    ].join(" ")}
                    aria-pressed={isSelected}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/24">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{audience.label}</span>
                        <span className="block truncate text-xs text-white/42">{audience.signals[0]}</span>
                      </span>
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-current opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {briefingStats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div key={stat.label} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <Icon className="h-4 w-4 text-cyan-100" aria-hidden />
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/38">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">{stat.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.06] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-100/22 bg-cyan-200/10 text-cyan-50">
                  <SelectedIcon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                    {selectedAudience.label} view
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {selectedAudience.headline}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
                    {selectedAudience.summary}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedAudience.signals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-white/12 bg-black/22 px-3 py-1.5 text-xs font-bold text-white/64"
                  >
                    {signal}
                  </span>
                ))}
              </div>

              <a
                href={selectedAudience.next}
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded-full border border-cyan-100/24 bg-cyan-200/12 px-4 py-2 text-sm font-bold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-cyan-200/20"
              >
                Jump to matching controls
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
