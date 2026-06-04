import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { SECURITY_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Security | Rearvy",
  description:
    "Security practices for Rearvy accounts, integrations, automation approvals, data access, and vulnerability reporting.",
};

const LAST_UPDATED = "June 3, 2026";
const SECURITY_REPORT_PATH = "/report-issue";

const sections = [
  {
    title: "Account protection",
    body: "Rearvy uses Firebase Authentication for account sign-in and session handling. Keep your account email secure, use strong passwords where password sign-in is enabled, and revoke access from devices you no longer trust.",
    icon: KeyRound,
  },
  {
    title: "Integration access",
    body: "Connected services such as Google, Shopify, Meta, GitHub, and payment providers use authorization flows where available. Rearvy stores integration access only for the features you connect and lets you disconnect integrations from settings.",
    icon: LockKeyhole,
  },
  {
    title: "Automation safeguards",
    body: "Workflows that send messages, use connected channels, control desktop actions, or perform sensitive operations are designed around approval gates and explicit user context instead of silent execution.",
    icon: ShieldCheck,
  },
  {
    title: "Reporting a security issue",
    body: `If you believe you found a vulnerability, email ${SECURITY_CONTACT_EMAIL} with a clear description, affected URL or feature, reproduction steps, and any relevant screenshots or logs. Do not access data that does not belong to you.`,
    icon: ShieldCheck,
    highlight: true,
  },
];

function SecurityHeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <ShieldCheck className="h-3.5 w-3.5" />
            Security posture
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Access, approvals, and reports stay explicit
          </p>
        </div>
        <span className="rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Active
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {[
          {
            title: "Account",
            detail: "Firebase Authentication handles sign-in and sessions.",
            icon: KeyRound,
          },
          {
            title: "Integrations",
            detail: "Connected services use authorized provider access.",
            icon: LockKeyhole,
          },
          {
            title: "Actions",
            detail: "Sensitive sends and automation steps are approval-oriented.",
            icon: ShieldCheck,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/52">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href={SECURITY_REPORT_PATH}
        className="block rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/14"
      >
        Report a security issue
      </Link>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
          Security
        </>
      }
      title={
        <>
          Security at
          <span className="block">Rearvy.</span>
        </>
      }
      description="How Rearvy protects accounts, connected integrations, automation actions, and security reports."
      primaryCta={{ href: SECURITY_REPORT_PATH, label: "Report an issue", icon: ArrowRight }}
      secondaryCta={{ href: "/privacy-policy", label: "Privacy Policy" }}
      sidePanel={<SecurityHeroPanel />}
      stats={[
        { value: "OAuth", label: "Integration access" },
        { value: "Approval", label: "Sensitive actions" },
        { value: LAST_UPDATED, label: "Last updated" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <article
                key={section.title}
                className={
                  section.highlight
                    ? "rounded-[8px] border border-cyan-200/24 bg-cyan-200/10 p-6 shadow-sm shadow-black/20 backdrop-blur-xl"
                    : "rounded-[8px] border border-white/12 bg-white/7 p-6 backdrop-blur-xl"
                }
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-semibold tracking-tight text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                  {section.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </RearvyPublicShell>
  );
}
