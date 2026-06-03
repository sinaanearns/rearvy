"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FileText, LifeBuoy, LockKeyhole, Trash2 } from "lucide-react";

import { buildMailto, PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

const shareTargets = [
  {
    label: "Share explorer",
    hash: "#privacy-explorer",
  },
  {
    label: "Share choices",
    hash: "#privacy-choice-lab",
  },
  {
    label: "Share request",
    hash: "#privacy-request-builder",
  },
  {
    label: "Share snapshot",
    hash: "#privacy-snapshot",
  },
  {
    label: "Share deletion",
    hash: "#privacy-deletion-checklist",
  },
  {
    label: "Share full policy",
    hash: "#privacy-policy-index",
  },
];

const actionLinks = [
  {
    href: "/data-delete",
    label: "Delete data",
    icon: Trash2,
  },
  {
    href: "/security",
    label: "Security",
    icon: LockKeyhole,
  },
  {
    href: buildMailto(PRIVACY_CONTACT_EMAIL),
    label: "Privacy help",
    icon: LifeBuoy,
  },
];

function getShareUrl(hash: string) {
  if (typeof window === "undefined") {
    return `/privacy-policy${hash}`;
  }

  return `${window.location.origin}/privacy-policy${hash}`;
}

export function PrivacyCommandBar() {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedVersion, setCopiedVersion] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Privacy command bar ready.");

  async function copyShareLink(hash: string) {
    const url = getShareUrl(hash);

    try {
      await navigator.clipboard.writeText(url);
      setCopiedHash(hash);
      setStatusMessage(`Copied link for ${hash.replace("#privacy-", "").replaceAll("-", " ")}.`);
      window.setTimeout(() => setCopiedHash((current) => (current === hash ? null : current)), 1800);
    } catch {
      setStatusMessage("Clipboard unavailable. Jumped to the selected privacy section.");
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function copyTrustSummary() {
    const summary = [
      "Rearvy privacy summary",
      "- Rearvy does not sell personal information.",
      "- Integrations use user-authorized provider permissions.",
      "- AI workflow context is used to complete requested work and should be reviewed for important decisions.",
      "- Eligible account data deletion can be requested from the account email.",
      `- Privacy contact: ${PRIVACY_CONTACT_EMAIL}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      setStatusMessage("Copied Rearvy privacy trust summary.");
      window.setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      setStatusMessage("Clipboard unavailable. Jumped to the privacy receipt.");
      document.querySelector("#privacy-receipt")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function copyVersionBadge() {
    const badge = "Rearvy Privacy Policy: current public version updated April 7, 2026. Rearvy does not sell personal information; integration access is permissioned; deletion requests are supported.";

    try {
      await navigator.clipboard.writeText(badge);
      setCopiedVersion(true);
      setStatusMessage("Copied Rearvy privacy version badge.");
      window.setTimeout(() => setCopiedVersion(false), 1800);
    } catch {
      setStatusMessage("Clipboard unavailable. Jumped to the privacy snapshot.");
      document.querySelector("#privacy-snapshot")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
      <div className="grid gap-3 rounded-xl border border-white/12 bg-black/40 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl xl:grid-cols-[1.15fr_0.85fr_1fr]">
        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
        <div className="rounded-lg border border-white/8 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/70">Share a section</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {shareTargets.map((target) => {
              const isCopied = copiedHash === target.hash;
              return (
                <button
                  key={target.hash}
                  type="button"
                  onClick={() => void copyShareLink(target.hash)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/7 px-4 py-2 text-sm font-semibold text-white/72 transition hover:border-cyan-200/30 hover:bg-cyan-200/10 hover:text-white"
                >
                  {isCopied ? <Check className="h-4 w-4 text-emerald-200" aria-hidden /> : <Copy className="h-4 w-4 text-cyan-100" aria-hidden />}
                  {isCopied ? "Copied" : target.label.replace("Share ", "")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/8 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100/70">Copy proof</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyVersionBadge()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-emerald-200/22 bg-emerald-200/10 px-4 py-2 text-sm font-bold text-emerald-50 transition hover:border-emerald-100/50 hover:bg-emerald-200/18"
            >
              {copiedVersion ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copiedVersion ? "Version copied" : "Version badge"}
            </button>
            <button
              type="button"
              onClick={() => void copyTrustSummary()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-cyan-200/22 bg-cyan-200/10 px-4 py-2 text-sm font-bold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-cyan-200/18"
            >
              {copiedSummary ? <Check className="h-4 w-4 text-emerald-200" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copiedSummary ? "Summary copied" : "Trust summary"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-white/8 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">Open tools</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-white/85"
            >
              <FileText className="h-4 w-4" aria-hidden />
              Print
            </button>
            {actionLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:border-white/28 hover:bg-white hover:text-black"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {link.label}
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
