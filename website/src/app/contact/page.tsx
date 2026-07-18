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
  return null;
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
    </RearvyPublicShell>
  );
}
