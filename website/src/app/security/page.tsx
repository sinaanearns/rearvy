import type { Metadata } from "next";
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildMailto, SECURITY_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Security | Rearvy",
  description:
    "Security practices for Rearvy accounts, integrations, automation approvals, data access, and vulnerability reporting.",
};

const LAST_UPDATED = "June 3, 2026";
const SECURITY_REPORT_MAILTO = buildMailto(SECURITY_CONTACT_EMAIL, "Rearvy security report");

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
      primaryCta={{ href: SECURITY_REPORT_MAILTO, label: "Report an issue", icon: ArrowRight }}
      secondaryCta={{ href: "/privacy-policy", label: "Privacy Policy" }}
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
                    ? "rounded-xl border border-cyan-200/24 bg-cyan-200/10 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl"
                    : "rounded-xl border border-white/12 bg-white/7 p-6 backdrop-blur-xl"
                }
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 bg-white/10 text-cyan-100">
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
