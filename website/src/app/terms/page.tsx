import type { Metadata } from "next";
import { ArrowRight, FileText } from "lucide-react";

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
      stats={[
        { value: "8", label: "Term sections" },
        { value: "Beta", label: "Product stage" },
        { value: LAST_UPDATED, label: "Last updated" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="rounded-xl border border-white/12 bg-black/45 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
          <div className="grid gap-5">
            {sections.map((section) => (
              <article
                key={section.title}
                className={
                  section.highlight
                    ? "rounded-xl border border-cyan-200/24 bg-cyan-200/10 p-5"
                    : "rounded-xl border border-white/10 bg-white/6 p-5"
                }
              >
                <h2 className="text-xl font-semibold tracking-tight text-white">{section.title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
