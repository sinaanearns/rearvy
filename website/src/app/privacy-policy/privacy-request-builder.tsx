"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Mail, PencilLine, Trash2 } from "lucide-react";

import { buildMailto, PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

const requestTypes = [
  {
    id: "access",
    label: "Access",
    icon: Download,
    subject: "Privacy Access Request",
    body: "I am requesting access to the personal data associated with my Rearvy account.",
  },
  {
    id: "correction",
    label: "Correction",
    icon: PencilLine,
    subject: "Privacy Correction Request",
    body: "I am requesting correction of personal data associated with my Rearvy account. I can provide the details that need to be updated.",
  },
  {
    id: "deletion",
    label: "Deletion",
    icon: Trash2,
    subject: "Data Deletion Request",
    body: "I am requesting deletion or anonymization of eligible personal data associated with my Rearvy account.",
  },
];

export function PrivacyRequestBuilder() {
  const [activeId, setActiveId] = useState(requestTypes[0].id);
  const [copied, setCopied] = useState(false);
  const activeType = useMemo(
    () => requestTypes.find((type) => type.id === activeId) ?? requestTypes[0],
    [activeId],
  );
  const ActiveIcon = activeType.icon;
  const body = `${activeType.body}

Account email:
Request details:

Please confirm receipt and let me know if you need anything else to verify account ownership.`;
  const mailto = buildMailto(PRIVACY_CONTACT_EMAIL, activeType.subject, body);

  async function copyRequest() {
    try {
      await navigator.clipboard.writeText(`Subject: ${activeType.subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = mailto;
    }
  }

  return (
    <section id="privacy-request-builder" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-white/[0.06] shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200/24 bg-emerald-200/10">
              <Mail className="h-5 w-5 text-emerald-100" aria-hidden />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/75">
              Request builder
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Draft the right privacy request
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/64">
              Choose a request type and Rearvy will prefill the subject and body so the support path is clear.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {requestTypes.map((type) => {
                const Icon = type.icon;
                const isActive = type.id === activeId;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setActiveId(type.id)}
                    className={[
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center text-xs font-bold transition",
                      isActive
                        ? "border-emerald-200/44 bg-emerald-200/12 text-white"
                        : "border-white/10 bg-black/18 text-white/58 hover:border-white/24 hover:bg-white/8 hover:text-white",
                    ].join(" ")}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
                  <ActiveIcon className="h-6 w-6" aria-hidden />
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-white/45">Email subject</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                  {activeType.subject}
                </h3>
              </div>
              <div className="rounded-full border border-white/12 bg-black/24 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white/58">
                Account email required
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/26 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">Message body</p>
              <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-white/70">{body}</pre>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={copyRequest}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white text-sm font-bold text-black transition hover:bg-emerald-100"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Copied" : "Copy request"}
              </button>
              <a
                href={mailto}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 text-sm font-bold text-white transition hover:border-white/28 hover:bg-white/12"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Open email
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
