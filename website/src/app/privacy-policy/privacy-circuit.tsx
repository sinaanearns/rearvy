"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Fingerprint, GitBranch, LockKeyhole, RotateCcw, Sparkles, Trash2 } from "lucide-react";

const circuitStages = [
  {
    id: "connect",
    title: "Connect",
    label: "User consent",
    icon: Fingerprint,
    detail: "Account sign-in or provider authorization starts the data path.",
    data: "Account identity, selected provider permissions, and the connected workspace you choose.",
    protection: "Provider authorization, scoped access, and a visible disconnect path.",
    action: "Review what you connect and revoke provider access when a workflow no longer needs it.",
  },
  {
    id: "use",
    title: "Use",
    label: "Task context",
    icon: Sparkles,
    detail: "Rearvy uses relevant context to complete the workflow the user requests.",
    data: "Prompts, files, messages, campaign context, storefront data, and integration results needed for the task.",
    protection: "Workflow-bounded processing, operational safeguards, and review-first AI output framing.",
    action: "Keep sensitive prompts specific, verify important outputs, and avoid sending data the task does not need.",
  },
  {
    id: "protect",
    title: "Protect",
    label: "Operational safeguards",
    icon: LockKeyhole,
    detail: "Sensitive credentials and product data are handled as service operations, not advertising inventory.",
    data: "Tokens, logs, security events, account settings, and support context needed to run the service.",
    protection: "Sensitive-token handling, access boundaries, and security-oriented retention where required.",
    action: "Use provider settings, Rearvy controls, and support requests to reduce or remove access.",
  },
  {
    id: "review",
    title: "Review",
    label: "Decision checkpoint",
    icon: CheckCircle2,
    detail: "Important AI-generated output should be reviewed before business, finance, or campaign use.",
    data: "Assistant responses, generated recommendations, task artifacts, and workflow summaries.",
    protection: "Clear beta AI limits, human review expectations, and correction/request paths.",
    action: "Treat AI output as a draft for high-impact work and ask for correction when account data is wrong.",
  },
  {
    id: "remove",
    title: "Remove",
    label: "Deletion path",
    icon: Trash2,
    detail: "You can disconnect integrations or request eligible account data deletion.",
    data: "Eligible account records, connected access, support requests, and retained compliance/security records.",
    protection: "Account-email verification, deletion or anonymization workflows, and limited exceptions where required.",
    action: "Email the privacy contact from your account email or use provider settings to revoke connected access.",
  },
];

export function PrivacyCircuit() {
  const [activeId, setActiveId] = useState(circuitStages[0].id);
  const activeStage = useMemo(
    () => circuitStages.find((stage) => stage.id === activeId) ?? circuitStages[0],
    [activeId],
  );
  const ActiveIcon = activeStage.icon;

  return (
    <section id="privacy-flow-graph" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-white/7 backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.66fr_1.34fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
              Flow graph
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Privacy as a live control circuit
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/62">
              Follow the route from consent to removal. Each stage shows the data involved, the boundary around it,
              and the action a user can take.
            </p>
            <a
              href="#privacy-request-builder"
              className="mt-6 inline-flex min-h-10 items-center justify-center rounded-full border border-cyan-100/24 bg-cyan-200/12 px-4 py-2 text-sm font-bold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-cyan-200/20"
            >
              Build a privacy request
            </a>
          </div>

          <div className="p-5 sm:p-7">
            <div className="relative">
              <div className="pointer-events-none absolute left-6 right-6 top-12 hidden h-px bg-gradient-to-r from-cyan-200/10 via-cyan-100/70 to-emerald-200/10 lg:block" />
              <div className="grid gap-3 lg:grid-cols-5">
                {circuitStages.map((stage, index) => {
                  const Icon = stage.icon;
                  const isActive = stage.id === activeId;

                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setActiveId(stage.id)}
                      className={[
                        "relative min-h-36 rounded-xl border p-4 text-left transition",
                        isActive
                          ? "border-cyan-200/42 bg-cyan-200/12 text-white shadow-[0_18px_55px_rgba(34,211,238,0.14)]"
                          : "border-white/10 bg-black/24 text-white/58 hover:border-white/24 hover:bg-white/8 hover:text-white",
                      ].join(" ")}
                      aria-pressed={isActive}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-full border font-mono text-xs font-bold",
                            isActive
                              ? "border-cyan-100/32 bg-cyan-100/18 text-cyan-50"
                              : "border-white/12 bg-white/6 text-white/50",
                          ].join(" ")}
                        >
                          0{index + 1}
                        </span>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="mt-5 block text-base font-semibold text-white">{stage.title}</span>
                      <span className="mt-2 block text-xs font-bold uppercase tracking-[0.13em] text-white/40">
                        {stage.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-xl border border-cyan-100/16 bg-cyan-200/10 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-100/24 bg-black/24 text-cyan-50">
                    <ActiveIcon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                      Active stage
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      {activeStage.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-white/64">{activeStage.detail}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  ["Data involved", activeStage.data],
                  ["Protection", activeStage.protection],
                  ["User action", activeStage.action],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">{label}</p>
                    <p className="mt-2 text-sm leading-6 text-white/62">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/18 px-4 py-3 text-xs font-bold uppercase tracking-[0.13em] text-white/42">
              <GitBranch className="h-4 w-4 text-cyan-100" aria-hidden />
              Consent
              <span className="text-white/24">/</span>
              Context
              <span className="text-white/24">/</span>
              Safeguards
              <span className="text-white/24">/</span>
              Review
              <span className="text-white/24">/</span>
              <RotateCcw className="h-4 w-4 text-emerald-100" aria-hidden />
              Removal
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
