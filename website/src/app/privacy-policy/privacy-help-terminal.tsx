import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck, Trash2 } from "lucide-react";

import { buildMailto, PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

const supportChecklist = [
  "Use the email tied to your Rearvy account.",
  "Include the request type in the subject line.",
  "Add enough detail to verify the account and locate the data.",
];

export function PrivacyHelpTerminal() {
  return (
    <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-white/7 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.7fr_1.3fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-200/24 bg-cyan-200/10">
              <ShieldCheck className="h-5 w-5 text-cyan-100" aria-hidden />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
              Privacy help terminal
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Need a human privacy route?
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/64">
              Send privacy questions, access requests, correction requests, export requests, or deletion requests from
              the email address tied to your Rearvy account.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:p-7 xl:grid-cols-[1fr_0.9fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/data-delete"
                className="group rounded-xl border border-white/12 bg-white p-5 text-black transition hover:bg-cyan-100"
              >
                <Trash2 className="h-5 w-5" aria-hidden />
                <p className="mt-4 text-lg font-bold">Delete data</p>
                <p className="mt-2 text-sm leading-6 text-black/62">
                  Start the documented deletion path for eligible account data.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">
                  Open route
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>

              <a
                href={buildMailto(PRIVACY_CONTACT_EMAIL)}
                className="group rounded-xl border border-white/12 bg-black/24 p-5 text-white transition hover:border-cyan-100/38 hover:bg-cyan-200/10"
              >
                <Mail className="h-5 w-5 text-cyan-100" aria-hidden />
                <p className="mt-4 text-lg font-bold">Email privacy</p>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Contact Rearvy privacy support for access, correction, export, or general questions.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-50">
                  Open email
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </a>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/24 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">Before you send</p>
              <div className="mt-4 grid gap-3">
                {supportChecklist.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" aria-hidden />
                    <p className="text-sm leading-6 text-white/64">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-cyan-100/16 bg-cyan-200/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-100/70">Contact</p>
                <p className="mt-2 break-all text-sm font-semibold text-white">{PRIVACY_CONTACT_EMAIL}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
