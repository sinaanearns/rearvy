import type { Metadata } from "next";
import { ArrowUpRight, Mail } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { buildGmailComposeUrl } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Contact Rearvy | Rearvy",
  description:
    "Contact Rearvy for product questions, account help, partnerships, or support.",
};

const CONTACT_EMAIL = "sinaan030@gmail.com";

const CONTACT_GMAIL_URL = buildGmailComposeUrl(
  CONTACT_EMAIL,
  "Rearvy contact",
  "Hi Rearvy team,\n\nI wanted to get in touch about...\n"
);

export default function ContactPage() {
  return (
    <RearvyPublicShell
      title={
        <>
          Let&apos;s talk
          <span className="block">about Rearvy.</span>
        </>
      }
      description="Reach the Rearvy team for product questions, account help, partnerships, or support."
      primaryCta={{ href: CONTACT_GMAIL_URL, label: CONTACT_EMAIL, icon: Mail }}
      secondaryCta={{ href: "/", label: "Home", icon: ArrowUpRight }}
    >
    </RearvyPublicShell>
  );
}
