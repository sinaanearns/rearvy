import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  Mail,
  PlugZap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildMailto, PUBLIC_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Terms of Service | Rearvy",
  description:
    "Terms of Service for Rearvy, including usage rules, billing terms, and beta product limitations.",
};

const LAST_UPDATED = "March 13, 2026";

const sections = [
  {
    id: "use-of-service",
    title: "1. Use of service",
    body: "You may use Rearvy only in compliance with applicable laws and these terms. You are responsible for your account credentials, connected integrations, and actions performed through your account.",
  },
  {
    id: "integrations-and-third-party-services",
    title: "2. Integrations and third-party services",
    body: "Rearvy may connect with third-party platforms such as Google, Shopify, Meta, and payment providers. Your use of those services remains subject to their own terms and privacy policies.",
  },
  {
    id: "billing-and-subscriptions",
    title: "3. Billing and subscriptions",
    body: "Paid plans may be billed through third-party processors. You authorize applicable charges based on your selected plan. Unless stated otherwise, fees are non-refundable except where required by law.",
  },
  {
    id: "beta-service-disclaimer",
    title: "4. Beta service disclaimer",
    body: "Rearvy is currently provided in beta. Features may change without prior notice, may contain defects, and may occasionally be unavailable. Outputs and recommendations are provided for informational purposes and should be independently validated before making business-critical decisions.",
    highlight: true,
  },
  {
    id: "acceptable-use",
    title: "5. Acceptable use",
    body: "You agree not to misuse the service, attempt unauthorized access, interfere with platform operations, or use the service for unlawful, harmful, fraudulent, or abusive purposes.",
  },
  {
    id: "limitation-of-liability",
    title: "6. Limitation of liability",
    body: "To the maximum extent permitted by law, Rearvy and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill arising from your use of the service.",
  },
  {
    id: "changes-to-terms",
    title: "7. Changes to terms",
    body: "We may update these terms from time to time. Continued use of the service after updates constitutes acceptance of the revised terms.",
  },
  {
    id: "contact",
    title: "8. Contact",
    body: `For questions about these terms, contact ${PUBLIC_CONTACT_EMAIL}.`,
  },
];

const agreementGuide = [
  {
    title: "Account responsibility",
    detail: "Use Rearvy legally and protect the credentials and integrations tied to your account.",
    icon: ShieldCheck,
  },
  {
    title: "Connected services",
    detail: "Google, Shopify, Meta, and payment tools keep their own policies and access controls.",
    icon: PlugZap,
  },
  {
    title: "Paid plans",
    detail: "Subscription and processor terms apply to any paid plan selected for the workspace.",
    icon: CreditCard,
  },
  {
    title: "Beta outputs",
    detail: "AI recommendations and automated work should be reviewed before critical use.",
    icon: Sparkles,
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
            <div
              key={item.title}
              className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">
                  {item.detail}
                </p>
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
  const termsQuestionHref = buildMailto(PUBLIC_CONTACT_EMAIL, "Terms Question");

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
      primaryCta={{
        href: "/privacy-policy",
        label: "Privacy Policy",
        icon: ArrowRight,
      }}
      secondaryCta={{ href: "/", label: "Back home" }}
      sidePanel={<TermsHeroPanel />}
      stats={[
        { value: "8", label: "Term sections" },
        { value: "Beta", label: "Product stage" },
        { value: LAST_UPDATED, label: "Last updated" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1180px] px-5 sm:px-6">
        <div className="grid gap-4 rounded-[8px] border border-white/12 bg-white/[0.06] p-5 shadow-sm shadow-black/15 backdrop-blur-xl md:grid-cols-[0.68fr_1.32fr] sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-normal text-cyan-100/78">
              Agreement guide
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Scan the obligations before reading the full terms.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/64">
              The detailed terms below remain authoritative; this guide keeps
              the main boundaries visible.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {agreementGuide.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="rounded-[8px] border border-white/10 bg-black/24 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-white/62">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[980px] px-5 sm:px-6">
        <div className="overflow-hidden rounded-[8px] border border-white/12 bg-black/50 shadow-sm shadow-black/25 backdrop-blur-xl">
          <div className="border-b border-white/10 px-5 py-5 sm:px-7">
            <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
              <div>
                <p className="text-sm font-medium text-cyan-100/74">
                  Terms in detail
                </p>
                <p className="mt-2 max-w-[68ch] text-sm leading-6 text-white/64">
                  The sections below describe the core usage, billing, integration,
                  and beta boundaries for using Rearvy.
                </p>
              </div>

              <nav aria-label="Terms sections" className="flex flex-wrap gap-2">
                {sections.map((section) => {
                  const title = getSectionTitleParts(section.title);

                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="rounded-[8px] border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/64 transition hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:text-white"
                    >
                      {title.number}
                      <span className="sr-only"> {title.title}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {sections.map((section) => {
              const title = getSectionTitleParts(section.title);

              return (
                <article
                  key={section.title}
                  id={section.id}
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

      <section className="mx-auto mt-6 w-full max-w-[980px] px-5 sm:px-6">
        <div className="grid gap-4 rounded-[8px] border border-white/12 bg-white/[0.06] p-5 shadow-sm shadow-black/15 backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
          <div>
            <p className="text-sm font-semibold text-white">
              Questions about these terms?
            </p>
            <p className="mt-2 max-w-[64ch] text-sm leading-6 text-white/64">
              Send a note from the account or business email you use with Rearvy so
              the team can route the question cleanly.
            </p>
          </div>
          <a
            href={termsQuestionHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/85"
          >
            Contact terms support
            <Mail className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
