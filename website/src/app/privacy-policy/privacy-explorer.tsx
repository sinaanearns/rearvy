"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Database,
  FileKey2,
  PlugZap,
  RotateCcw,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";

import { PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

const explorerModes = [
  {
    id: "account",
    label: "Account",
    icon: UserRound,
    headline: "Identity data stays tied to your workspace access.",
    summary:
      "Rearvy uses account details to sign you in, keep your profile consistent, and route support or deletion requests to the right owner.",
    collects: ["Name", "Email", "Profile image", "Authentication details"],
    use: "Authentication, account setup, support, important security notices, and service continuity.",
    control: "You can request access, correction, export, or deletion from the account email address.",
    status: "User-owned",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: PlugZap,
    headline: "Connected platforms only run after you authorize them.",
    summary:
      "When you connect services, Rearvy handles the tokens, permissions, metadata, and synced records needed to operate the workflows you choose.",
    collects: ["OAuth tokens", "Platform metadata", "Synced records", "Permission scopes"],
    use: "Running Gmail, Shopify, Meta, GitHub, analytics, payments, and other connected workflows.",
    control: "Disconnect in Rearvy settings where available, or remove access inside the provider's app permissions.",
    status: "Permission based",
  },
  {
    id: "ai",
    label: "AI Workflows",
    icon: Bot,
    headline: "AI context is used to complete the work you ask for.",
    summary:
      "Prompts, task context, generated outputs, and workflow results may be processed so Rearvy can research, plan, write, automate, and summarize.",
    collects: ["Prompts", "Task context", "Generated outputs", "Workflow results"],
    use: "Answering requests, producing drafts, running automations, generating reports, and improving product reliability.",
    control: "Review critical outputs before relying on them, especially for business, finance, campaigns, or automated actions.",
    status: "Review first",
  },
  {
    id: "logs",
    label: "Reliability",
    icon: Database,
    headline: "Technical signals help keep the product stable and secure.",
    summary:
      "Rearvy may process usage events, technical logs, device/browser details, and security signals to detect abuse and improve reliability.",
    collects: ["Usage events", "Technical logs", "Device details", "Security signals"],
    use: "Debugging, performance improvement, abuse prevention, security monitoring, and service operations.",
    control: "These records are retained only as long as needed for service delivery, compliance, security, and legitimate business purposes.",
    status: "Operational",
  },
  {
    id: "deletion",
    label: "Deletion",
    icon: Trash2,
    headline: "Deletion requests have a clear path.",
    summary:
      "Rearvy supports account data deletion requests and removes or anonymizes personal data unless retention is required by law.",
    collects: ["Account email", "Deletion request", "Provider removal status", "Retention exceptions"],
    use: "Verifying request ownership, removing eligible personal data, and preserving legally required records only when necessary.",
    control: `Email ${PRIVACY_CONTACT_EMAIL} with subject "Data Deletion Request" from your Rearvy account email address.`,
    status: "Supported",
  },
];

export function PrivacyExplorer() {
  const [activeId, setActiveId] = useState(explorerModes[0].id);
  const activeMode = useMemo(
    () => explorerModes.find((mode) => mode.id === activeId) ?? explorerModes[0],
    [activeId],
  );
  const ActiveIcon = activeMode.icon;

  return (
    <section id="privacy-explorer" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-black/42 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 bg-white/8">
              <Shield className="h-5 w-5 text-cyan-100" aria-hidden />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
              Interactive explorer
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Tap through the privacy model
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/64">
              Pick a data area to see what Rearvy may process, why it exists, and what control path applies.
            </p>

            <div className="mt-6 grid gap-2">
              {explorerModes.map((mode) => {
                const Icon = mode.icon;
                const isActive = mode.id === activeId;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setActiveId(mode.id)}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition",
                      isActive
                        ? "border-cyan-200/42 bg-cyan-200/12 text-white shadow-[0_12px_40px_rgba(34,211,238,0.08)]"
                        : "border-white/10 bg-white/5 text-white/62 hover:border-white/24 hover:bg-white/8 hover:text-white",
                    ].join(" ")}
                    aria-pressed={isActive}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0 text-cyan-100" aria-hidden />
                      <span className="truncate text-sm font-semibold">{mode.label}</span>
                    </span>
                    <span className="font-mono text-xs text-white/36">{mode.status}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden p-5 sm:p-7">
            <div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
                    <ActiveIcon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                    {activeMode.headline}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/66">
                    {activeMode.summary}
                  </p>
                </div>

                <div className="rounded-full border border-white/12 bg-white/7 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/58">
                  {activeMode.status}
                </div>
              </div>

              <div className="mt-7 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl border border-white/10 bg-white/6 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">May include</p>
                  <div className="mt-4 grid gap-2">
                    {activeMode.collects.map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-lg bg-black/24 px-3 py-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden />
                        <span className="text-sm font-medium text-white/76">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/6 p-5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                      <FileKey2 className="h-4 w-4 text-cyan-100" aria-hidden />
                      Why it is used
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/68">{activeMode.use}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/6 p-5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                      <RotateCcw className="h-4 w-4 text-amber-100" aria-hidden />
                      Your control path
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/68">{activeMode.control}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
