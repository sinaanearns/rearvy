import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  FileKey2,
  LockKeyhole,
  Mail,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildMailto, PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Privacy Policy | Rearvy",
  description:
    "Rearvy's privacy policy for account data, integrations, AI workflows, retention, deletion, and user rights.",
  alternates: {
    canonical: "/privacy-policy",
  },
  openGraph: {
    title: "Rearvy Privacy Policy",
    description:
      "How Rearvy handles account data, integrations, AI workflows, retention, deletion, and privacy requests.",
    url: "/privacy-policy",
    siteName: "Rearvy",
    images: [
      {
        url: "/rearvy-social.png",
        width: 1200,
        height: 800,
        alt: "Rearvy Privacy Policy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rearvy Privacy Policy",
    description:
      "How Rearvy handles account data, integrations, AI workflows, retention, deletion, and privacy requests.",
    images: ["/rearvy-social.png"],
  },
};

const LAST_UPDATED = "April 7, 2026";

type PolicyItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  body: string[];
  highlight?: boolean;
};

const keyPromises = [
  {
    title: "No personal data sales",
    body: "Rearvy does not sell personal information.",
    icon: ShieldCheck,
  },
  {
    title: "User-approved integrations",
    body: "Connected platforms only run after you authorize the relevant provider flow.",
    icon: PlugZap,
  },
  {
    title: "Sensitive tokens",
    body: "Integration credentials and access tokens are handled as operational secrets.",
    icon: LockKeyhole,
  },
  {
    title: "Deletion support",
    body: "You can request deletion or anonymization of eligible account data.",
    icon: Trash2,
  },
];

const userControls = [
  "Disconnect integrations inside Rearvy where available, or from the provider's app permissions.",
  "Request access, correction, export, or deletion of eligible personal information by contacting privacy support.",
  "Use the account email address tied to Rearvy when making privacy or deletion requests.",
  "Review AI outputs before relying on them for critical business, finance, campaign, or automated decisions.",
];

const policySections: PolicyItem[] = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    icon: FileKey2,
    body: [
      "We may collect account information such as your name, email address, profile image, authentication details, and account settings.",
      "When you connect integrations, we may process tokens, permissions, synced records, and metadata needed to access the selected platform data you authorize.",
      "We also collect technical data such as log events, device/browser details, usage analytics, and security signals to operate, secure, and improve Rearvy.",
    ],
  },
  {
    id: "how-we-use-information",
    title: "2. How We Use Information",
    icon: Sparkles,
    body: [
      "We use information to provide product functionality, authenticate users, run connected integrations, generate AI-assisted workflows, improve service performance, detect abuse, provide support, and send important product or security updates.",
    ],
  },
  {
    id: "data-sharing",
    title: "3. Data Sharing",
    icon: ShieldCheck,
    body: [
      "We do not sell personal information.",
      "We may share data with infrastructure, analytics, payment, integration, and service providers only as needed to operate Rearvy, or when required by law.",
      "When you connect a third-party service such as Google, Shopify, Meta, GitHub, or a payment provider, your use of that service remains subject to its own terms and privacy policy.",
    ],
  },
  {
    id: "legal-bases-and-permissions",
    title: "4. Legal Bases and Permissions",
    icon: PlugZap,
    body: [
      "We process data to perform our contract with you, for legitimate interests such as service security and product improvement, and where required, based on your consent.",
      "If you connect third-party services, Rearvy only accesses data you authorize through the relevant permission flow.",
    ],
  },
  {
    id: "security-and-retention",
    title: "5. Security and Retention",
    icon: LockKeyhole,
    body: [
      "We apply reasonable technical and organizational safeguards to protect data.",
      "No system is fully secure, and you acknowledge this risk by using the service.",
      "We retain data only as long as necessary for service delivery, legal compliance, dispute resolution, security, and legitimate business purposes.",
    ],
  },
  {
    id: "ai-and-beta-product-notice",
    title: "6. AI and Beta Product Notice",
    icon: Sparkles,
    highlight: true,
    body: [
      "Rearvy is currently in beta. Features, models, integrations, and outputs may change, contain inaccuracies, or be interrupted while we improve reliability.",
      "Please independently verify critical business decisions, reports, campaigns, financial analysis, and automated actions before relying on them.",
    ],
  },
  {
    id: "your-choices-and-rights",
    title: "7. Your Choices and Rights",
    icon: CheckCircle2,
    body: [
      "You can manage account information, connected integrations, and communication preferences in app settings where available.",
      "Depending on your location, you may request access, correction, deletion, or export of your personal information by contacting us.",
    ],
  },
  {
    id: "data-deletion-instructions",
    title: "8. Data Deletion Instructions",
    icon: Trash2,
    body: [
      `You can request deletion of your Rearvy account data by emailing ${PRIVACY_CONTACT_EMAIL} with the subject line "Data Deletion Request" from your account email address.`,
      "If you connected Facebook or Instagram, you can also remove Rearvy access in your Meta settings. After receiving your request, we delete or anonymize personal data unless retention is required by law.",
    ],
  },
  {
    id: "childrens-privacy",
    title: "9. Children's Privacy",
    icon: ShieldCheck,
    body: [
      "Rearvy is not directed to children under 13, and we do not knowingly collect personal information from children.",
    ],
  },
  {
    id: "policy-updates",
    title: "10. Policy Updates",
    icon: CheckCircle2,
    body: [
      'We may update this policy from time to time. Material changes will be posted on this page with a revised "Last updated" date.',
    ],
  },
  {
    id: "contact",
    title: "11. Contact",
    icon: Mail,
    body: [`For privacy questions, contact us at ${PRIVACY_CONTACT_EMAIL}.`],
  },
];

function SectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
      <Icon className="h-4 w-4" aria-hidden />
    </div>
  );
}

function PrivacyHeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <FileKey2 className="h-3.5 w-3.5" />
            Data controls
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Clear handling for account data, integrations, and AI workflows
          </p>
        </div>
        <span className="rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Privacy
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {[
          {
            title: "Account data",
            detail: "Profile, settings, sessions, and workspace records stay tied to your account.",
            icon: FileKey2,
          },
          {
            title: "Integrations",
            detail: "Connected services run through user-authorized provider access.",
            icon: PlugZap,
          },
          {
            title: "AI workflows",
            detail: "Outputs should be reviewed before critical business or automated use.",
            icon: Sparkles,
          },
          {
            title: "Deletion",
            detail: "Eligible account records can be requested for deletion or anonymization.",
            icon: Trash2,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
        <div className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3">
          <p className="text-xs font-medium text-cyan-100/74">Policy sections</p>
          <p className="mt-1 text-2xl font-semibold text-white">{policySections.length}</p>
        </div>
        <div className="rounded-[8px] border border-white/10 bg-black/24 p-3">
          <p className="text-xs font-medium text-white/54">Last updated</p>
          <p className="mt-1 text-sm font-semibold text-white">{LAST_UPDATED}</p>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const deletionHref = buildMailto(PRIVACY_CONTACT_EMAIL, "Data Deletion Request");
  const privacyQuestionHref = buildMailto(PRIVACY_CONTACT_EMAIL, "Privacy Question");

  return (
    <RearvyPublicShell
      className="privacy-policy-page"
      eyebrow={
        <>
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
          Privacy
        </>
      }
      title={
        <>
          Privacy
          <span className="block">Policy.</span>
        </>
      }
      description="A simple explanation of what Rearvy collects, how it uses data, how integrations work, and how to request deletion or contact privacy support."
      primaryCta={{ href: "/data-delete", label: "Request deletion", icon: ArrowRight }}
      secondaryCta={{ href: "/", label: "Home" }}
      sidePanel={<PrivacyHeroPanel />}
      stats={[
        { value: "No", label: "Personal data sales" },
        { value: "11", label: "Policy sections" },
        { value: LAST_UPDATED, label: "Last updated" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1180px] px-6">
        <div className="rounded-[8px] border border-white/12 bg-black/45 p-5 shadow-sm shadow-black/20 backdrop-blur-xl sm:p-7">
          <div className="grid gap-4 md:grid-cols-4">
            {keyPromises.map((item) => (
              <article key={item.title} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-4">
                <SectionIcon icon={item.icon} />
                <h2 className="mt-4 text-base font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/68">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="grid gap-6 rounded-[8px] border border-white/12 bg-white/7 p-5 backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr] sm:p-7">
          <div>
            <p className="text-xs font-medium text-cyan-100/78">Your controls</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              The practical privacy actions stay clear.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/68">
              This page keeps the policy readable and avoids extra tools, dashboards, or simulated privacy consoles.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={deletionHref}
                className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                Start deletion email
                <Mail className="h-4 w-4" aria-hidden />
              </a>
              <a
                href={privacyQuestionHref}
                className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
              >
                Ask a privacy question
              </a>
            </div>
          </div>

          <div className="grid gap-3">
            {userControls.map((item) => (
              <div key={item} className="flex gap-3 rounded-[8px] border border-white/10 bg-black/22 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" aria-hidden />
                <p className="text-sm leading-6 text-white/68">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="rounded-[8px] border border-white/12 bg-black/40 p-5 backdrop-blur-xl sm:p-6">
          <p className="text-xs font-medium text-white/58">Jump to section</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {policySections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-[8px] border border-white/12 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/72 transition hover:border-cyan-200/40 hover:text-white"
              >
                {section.title.replace(/^\d+\.\s*/, "")}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="rounded-[8px] border border-white/12 bg-black/45 p-5 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium text-cyan-100/78">Full policy</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Rearvy Privacy Policy
              </h2>
            </div>
            <p className="text-sm font-semibold text-white/60">Last updated {LAST_UPDATED}</p>
          </div>

          <div className="mt-6 grid gap-5">
            {policySections.map((section) => (
              <article
                id={section.id}
                key={section.id}
                className={[
                  "scroll-mt-28 rounded-[8px] border p-5",
                  section.highlight
                    ? "border-cyan-200/24 bg-cyan-200/10"
                    : "border-white/10 bg-white/[0.06]",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <SectionIcon icon={section.icon} />
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold tracking-tight text-white">{section.title}</h3>
                    <div className="mt-3 grid gap-3">
                      {section.body.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
        <div className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-5 backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-cyan-100/78">Contact</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Privacy questions?</h2>
              <p className="mt-2 text-sm leading-6 text-white/66">
                Contact {PRIVACY_CONTACT_EMAIL} for access, correction, export, deletion, or general privacy questions.
              </p>
            </div>
            <a
              href={privacyQuestionHref}
              className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              Email privacy support
              <Mail className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
