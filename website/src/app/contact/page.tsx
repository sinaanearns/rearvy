import type { Metadata } from "next";
import {
  ArrowUpRight,
  ClipboardList,
  Clock3,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildMailto, PUBLIC_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Contact Rearvy | Rearvy",
  description:
    "Contact Rearvy for product questions, account help, partnerships, or support.",
};

const CONTACT_MAILTO = buildMailto(
  PUBLIC_CONTACT_EMAIL,
  "Rearvy contact",
  "Hi Rearvy team,\n\nI wanted to get in touch about...\n"
);

const contactReasons = [
  {
    title: "Product questions",
    detail: "Ask about the platform, features, pricing, or how Rearvy fits your workflow.",
    icon: Sparkles,
  },
  {
    title: "Account help",
    detail: "Send account questions with the email address you use for Rearvy and any useful context.",
    icon: ShieldCheck,
  },
  {
    title: "Partnerships and support",
    detail: "Send partnership ideas, media requests, or support details with any useful links or screenshots.",
    icon: Clock3,
  },
];

const messageFlow = [
  {
    step: "01",
    title: "Choose topic",
    detail: "Product, account, partnership, or support context.",
    icon: Sparkles,
  },
  {
    step: "02",
    title: "Add detail",
    detail: "Account email, screenshots, links, or expected result.",
    icon: ClipboardList,
  },
  {
    step: "03",
    title: "Send",
    detail: "The draft opens to the Rearvy team inbox.",
    icon: Send,
  },
];

function ContactHeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <Mail className="h-3.5 w-3.5" />
            Inbox triage
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Route product, access, and support notes cleanly
          </p>
        </div>
        <span className="rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Direct
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {[
          {
            title: "Product",
            detail: "Feature fit, pricing, workflow questions",
            icon: Sparkles,
          },
          {
            title: "Access",
            detail: "Account questions and workspace setup",
            icon: ShieldCheck,
          },
          {
            title: "Support",
            detail: "Screenshots, account details, useful links",
            icon: Clock3,
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
                <p className="mt-1 text-xs leading-5 text-white/60">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      <a
        href={CONTACT_MAILTO}
        className="block rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/14"
      >
        {PUBLIC_CONTACT_EMAIL}
      </a>
    </div>
  );
}

export default function ContactPage() {
  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <Mail className="h-3.5 w-3.5 text-cyan-200" />
          Contact
        </>
      }
      title={
        <>
          Let&apos;s talk
          <span className="block">about Rearvy.</span>
        </>
      }
      description="Reach the Rearvy team for product questions, account help, partnerships, or support."
      primaryCta={{ href: CONTACT_MAILTO, label: "Email us", icon: Mail }}
      secondaryCta={{ href: "/demo", label: "Demo", icon: ArrowUpRight }}
      sidePanel={<ContactHeroPanel />}
      stats={[
        { value: "Direct", label: "Team inbox" },
        { value: "Account", label: "Help" },
        { value: "Support", label: "Product questions" },
      ]}
    >
      <section aria-labelledby="contact-message-routing-title" className="mx-auto w-full max-w-[1180px] px-6">
        <div className="grid gap-5 border-y border-white/12 bg-white/[0.04] py-6 backdrop-blur-xl lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div className="px-0 sm:px-2">
            <p className="text-sm font-medium text-cyan-100/74">
              Message routing
            </p>
            <h2 id="contact-message-routing-title" className="mt-3 max-w-md text-[clamp(1.65rem,3.2vw,2.55rem)] font-semibold leading-tight text-white">
              Send a clear note without adding another form.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/68">
              Use your email app, keep your records, and include enough context for the
              team to route the request correctly.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {messageFlow.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.step} className="min-w-0 rounded-[8px] border border-white/12 bg-black/24 p-4 shadow-sm shadow-black/15">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-white/46">{item.step}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/66">{item.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 grid w-full max-w-[1180px] gap-6 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[8px] border border-white/12 bg-black/45 p-6 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-8">
          <p className="text-sm font-medium text-white/58">
            Direct contact
          </p>
          <a
            href={CONTACT_MAILTO}
            className="mt-4 block text-[clamp(1.65rem,3.3vw,2.65rem)] font-semibold leading-tight text-white transition hover:text-cyan-100"
          >
            {PUBLIC_CONTACT_EMAIL}
          </a>
          <p className="mt-5 text-base leading-7 text-white/68">
            Use the email link for the fastest route. Include any business, account, or
            screenshot details that help us route the message.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {contactReasons.map((reason) => {
            const Icon = reason.icon;

            return (
              <article key={reason.title} className="rounded-[8px] border border-white/12 bg-white/7 p-5 shadow-sm shadow-black/15 backdrop-blur-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">{reason.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/68">{reason.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </RearvyPublicShell>
  );
}
