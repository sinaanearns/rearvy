import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bug,
  ClipboardList,
  FileText,
  ListChecks,
  LockKeyhole,
  Mail,
  Send,
  ShieldCheck,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildMailto, SECURITY_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Report an Issue | Rearvy",
  description:
    "Report a Rearvy security issue, product issue, affected URL, reproduction steps, and supporting screenshots or logs.",
};

const ISSUE_REPORT_MAILTO = buildMailto(
  SECURITY_CONTACT_EMAIL,
  "Rearvy issue report",
  [
    "Hi Rearvy team,",
    "",
    "Issue type:",
    "Affected URL or feature:",
    "What happened:",
    "Steps to reproduce:",
    "Expected result:",
    "Screenshots or logs:",
    "",
  ].join("\n")
);

const reportDetails = [
  {
    title: "Affected place",
    body: "Include the URL, feature name, account area, or integration where the issue happened.",
    icon: FileText,
  },
  {
    title: "Reproduction steps",
    body: "List the exact clicks, inputs, or automation steps that caused the issue.",
    icon: Bug,
  },
  {
    title: "Security impact",
    body: "For vulnerabilities, describe what data, permission, account, or workflow could be affected.",
    icon: LockKeyhole,
  },
];

const intakeFlow = [
  {
    step: "01",
    title: "Draft",
    detail: "Open the prefilled email.",
    icon: Mail,
  },
  {
    step: "02",
    title: "Evidence",
    detail: "Add steps, URL, logs, or screenshots.",
    icon: ClipboardList,
  },
  {
    step: "03",
    title: "Triage",
    detail: "The report goes to the security inbox.",
    icon: Send,
  },
];

function ReportIssuePanel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <ShieldCheck className="h-3.5 w-3.5" />
            Issue intake
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Send the details needed to investigate quickly
          </p>
        </div>
        <span className="rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Direct
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {reportDetails.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">{item.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 border-t border-white/10 pb-4 pt-4 sm:grid-cols-3">
        {intakeFlow.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.step} className="rounded-[8px] border border-white/10 bg-black/24 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-cyan-100/78">{item.step}</span>
                <Icon className="h-4 w-4 text-cyan-100" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-white/60">{item.detail}</p>
            </div>
          );
        })}
      </div>

      <a
        href={ISSUE_REPORT_MAILTO}
        className="flex items-center justify-between gap-3 rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/14"
      >
        Open email draft
        <Mail className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}

export default function ReportIssuePage() {
  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <Bug className="h-3.5 w-3.5 text-cyan-200" />
          Report an issue
        </>
      }
      title={
        <>
          Report an issue
          <span className="block">to Rearvy.</span>
        </>
      }
      description="Share security reports, product issues, affected pages, reproduction steps, screenshots, or logs with the Rearvy team."
      primaryCta={{ href: ISSUE_REPORT_MAILTO, label: "Open email draft", icon: Mail }}
      secondaryCta={{ href: "/security", label: "Security", icon: ArrowLeft }}
      sidePanel={<ReportIssuePanel />}
      stats={[
        { value: "Email", label: "Direct intake" },
        { value: "Steps", label: "Reproduction details" },
        { value: "Logs", label: "Useful evidence" },
      ]}
    >
      <section className="mx-auto grid w-full max-w-[1180px] gap-6 px-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[8px] border border-white/12 bg-black/45 p-6 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-8">
          <p className="text-sm font-medium text-white/58">Send reports to</p>
          <a
            href={ISSUE_REPORT_MAILTO}
            className="mt-4 block break-words text-[clamp(1.65rem,3.3vw,2.65rem)] font-semibold leading-tight text-white transition hover:text-cyan-100"
          >
            {SECURITY_CONTACT_EMAIL}
          </a>
          <p className="mt-5 text-base leading-7 text-white/68">
            If the email draft does not open, copy this address and include the issue type,
            affected URL or feature, reproduction steps, expected result, and any screenshots
            or logs that help explain the problem.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {reportDetails.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="rounded-[8px] border border-white/12 bg-white/7 p-5 shadow-sm shadow-black/15 backdrop-blur-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/68">{item.body}</p>
              </article>
            );
          })}
        </div>

        <div className="grid gap-4 rounded-[8px] border border-white/12 bg-white/[0.06] p-5 shadow-sm shadow-black/15 backdrop-blur-xl sm:grid-cols-[220px_minmax(0,1fr)] lg:col-span-2">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
              <ListChecks className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white">Email packet</h2>
            <p className="mt-2 text-sm leading-6 text-white/64">
              The draft opens with the fields Rearvy needs to reproduce and route the issue.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {intakeFlow.map((item) => (
              <div key={item.step} className="rounded-[8px] border border-white/10 bg-black/24 p-3">
                <p className="text-xs font-semibold text-cyan-100/78">{item.step}</p>
                <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/60">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-[8px] border border-white/18 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:border-white/42 hover:bg-white/10"
          >
            Contact Rearvy for non-security questions
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
