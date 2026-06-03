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
      stats={[
        { value: "Direct", label: "Team inbox" },
        { value: "Pro", label: "Business access" },
        { value: "Support", label: "Product questions" },
      ]}
    >
      <section className="mx-auto grid w-full max-w-[1180px] gap-6 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-white/12 bg-black/45 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
            Direct contact
          </p>
          <a
            href={CONTACT_MAILTO}
            className="mt-4 block break-all text-3xl font-semibold leading-tight text-white transition hover:text-cyan-100 sm:text-5xl"
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
              <article key={reason.title} className="rounded-xl border border-white/12 bg-white/7 p-5 backdrop-blur-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-white/10 text-cyan-100">
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
