import type { Metadata } from "next";
import { ArrowUpRight, Clock3, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildMailto, PUBLIC_CONTACT_EMAIL } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Contact Rearvy | Rearvy",
  description:
    "Contact Rearvy for product questions, business access, partnerships, or support.",
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
    title: "Business access",
    detail: "If you want free Pro access, include your business name and how you plan to use Rearvy.",
    icon: ShieldCheck,
  },
  {
    title: "Partnerships and support",
    detail: "Send partnership ideas, media requests, or support details with any useful links or screenshots.",
    icon: Clock3,
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
            detail: "Business profile and free Pro request",
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
                <p className="mt-1 text-xs leading-5 text-white/52">{item.detail}</p>
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
      description="Reach the Rearvy team for product questions, business access, partnerships, or support."
      primaryCta={{ href: CONTACT_MAILTO, label: "Email us", icon: Mail }}
      secondaryCta={{ href: "/signup", label: "Start free", icon: ArrowUpRight }}
      sidePanel={<ContactHeroPanel />}
      stats={[
        { value: "Direct", label: "Team inbox" },
        { value: "Pro", label: "Business access" },
        { value: "Support", label: "Product questions" },
      ]}
    >
      <section className="mx-auto grid w-full max-w-[1180px] gap-6 px-6 lg:grid-cols-[0.9fr_1.1fr]">
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
                <p className="mt-2 text-sm leading-6 text-white/64">{reason.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </RearvyPublicShell>
  );
}
