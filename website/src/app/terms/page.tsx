import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, FileText, ShieldCheck } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Terms of Service | Rearvy",
  description:
    "Terms of Service for Rearvy, including usage rules, billing terms, and beta product limitations.",
};

const LAST_UPDATED = "March 13, 2026";

const sections = [
  {
    title: "1. Use of service",
    body: "You may use Rearvy only in compliance with applicable laws and these terms. You are responsible for your account credentials, connected integrations, and actions performed through your account.",
  },
  {
    title: "2. Integrations and third-party services",
    body: "Rearvy may connect with third-party platforms such as Google, Shopify, Meta, and payment providers. Your use of those services remains subject to their own terms and privacy policies.",
  },
  {
    title: "3. Billing and subscriptions",
    body: "Paid plans may be billed through third-party processors. You authorize applicable charges based on your selected plan. Unless stated otherwise, fees are non-refundable except where required by law.",
  },
  {
    title: "4. Beta service disclaimer",
    body: "Rearvy is currently provided in beta. Features may change without prior notice, may contain defects, and may occasionally be unavailable. Outputs and recommendations are provided for informational purposes and should be independently validated before making business-critical decisions.",
    highlight: true,
  },
  {
    title: "5. Acceptable use",
    body: "You agree not to misuse the service, attempt unauthorized access, interfere with platform operations, or use the service for unlawful, harmful, fraudulent, or abusive purposes.",
  },
  {
    title: "6. Limitation of liability",
    body: "To the maximum extent permitted by law, Rearvy and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill arising from your use of the service.",
  },
  {
    title: "7. Changes to terms",
    body: "We may update these terms from time to time. Continued use of the service after updates constitutes acceptance of the revised terms.",
  },
  {
    title: "8. Contact",
    body: `For questions about these terms, contact ${PUBLIC_CONTACT_EMAIL}.`,
  },
];

function getSectionTitleParts(title: string) {
  const match = title.match(/^(\d+)\.\s*(.+)$/);

  return {
    number: match?.[1] ?? "",
    title: match?.[2] ?? title,
  };
}

function TermsHeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <FileText className="h-3.5 w-3.5" />
            Terms summary
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Clear boundaries for beta use and connected actions
          </p>
        </div>
        <span className="rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Beta
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {[
          {
            title: "Use",
            detail: "Keep account credentials and connected integrations secure.",
            icon: CheckCircle2,
          },
          {
            title: "Integrations",
            detail: "Third-party platforms keep their own terms and controls.",
            icon: ShieldCheck,
          },
          {
            title: "Outputs",
            detail: "Validate important recommendations before business-critical use.",
            icon: FileText,
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

      <div className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3">
        <p className="text-xs font-medium text-cyan-100/74">
          Last updated
        </p>
        <p className="mt-1 text-2xl font-semibold text-white">{LAST_UPDATED}</p>
      </div>
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <FileText className="h-3.5 w-3.5 text-cyan-200" />
          Legal
        </>
      }
      title={
        <>
          Terms of
          <span className="block">Service.</span>
        </>
      }
      description="The usage rules, billing notes, integration boundaries, and beta limitations that govern Rearvy."
      primaryCta={{ href: "/privacy-policy", label: "Privacy Policy", icon: ArrowRight }}
      secondaryCta={{ href: "/", label: "Back home" }}
      sidePanel={<TermsHeroPanel />}
      stats={[
        { value: "8", label: "Term sections" },
        { value: "Beta", label: "Product stage" },
        { value: LAST_UPDATED, label: "Last updated" },
      ]}
    >
      <section className="mx-auto w-full max-w-[980px] px-5 sm:px-6">
        <div className="overflow-hidden rounded-[8px] border border-white/12 bg-black/50 shadow-sm shadow-black/25 backdrop-blur-xl">
          <div className="border-b border-white/10 px-5 py-5 sm:px-7">
            <p className="text-sm font-medium text-cyan-100/74">
              Terms in detail
            </p>
            <p className="mt-2 max-w-[68ch] text-sm leading-6 text-white/58">
              The sections below describe the core usage, billing, integration, and beta boundaries for using Rearvy.
            </p>
          </div>

          <div className="divide-y divide-white/10">
            {sections.map((section) => {
              const title = getSectionTitleParts(section.title);

              return (
                <article
                  key={section.title}
                  className={
                    section.highlight
                      ? "grid gap-4 bg-cyan-200/[0.08] px-5 py-6 sm:grid-cols-[48px_minmax(0,1fr)] sm:px-7"
                      : "grid gap-4 bg-white/[0.035] px-5 py-6 sm:grid-cols-[48px_minmax(0,1fr)] sm:px-7"
                  }
                >
                  <div
                    className={
                      section.highlight
                        ? "flex h-9 w-9 items-center justify-center rounded-[8px] border border-cyan-200/30 bg-cyan-200/12 text-sm font-semibold text-cyan-100"
                        : "flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-sm font-semibold text-white/70"
                    }
                  >
                    {title.number}
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">
                      {title.title}
                    </h2>
                    <p className="mt-3 max-w-[70ch] text-[15px] leading-7 text-white/70 sm:text-base">
                      {section.body}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
