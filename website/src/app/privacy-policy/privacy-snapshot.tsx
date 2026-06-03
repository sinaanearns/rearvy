"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Code2, Copy, ShieldCheck } from "lucide-react";

import { PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

type SnapshotItem = {
  label: string;
  value: string;
  note: string;
};

type PrivacySnapshotProps = {
  lastUpdated: string;
  items: SnapshotItem[];
};

export function PrivacySnapshot({ lastUpdated, items }: PrivacySnapshotProps) {
  const [copied, setCopied] = useState(false);
  const snapshot = useMemo(
    () => ({
      product: "Rearvy",
      document: "Privacy Policy",
      lastUpdated,
      summary: items.map((item) => ({
        control: item.label,
        status: item.value,
        note: item.note,
      })),
      contact: PRIVACY_CONTACT_EMAIL,
    }),
    [items, lastUpdated],
  );
  const snapshotText = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);

  async function copySnapshot() {
    try {
      await navigator.clipboard.writeText(snapshotText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      document.querySelector("#privacy-receipt")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <section id="privacy-snapshot" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-black/44 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-200/24 bg-cyan-200/10">
              <ClipboardCheck className="h-5 w-5 text-cyan-100" aria-hidden />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
              Copyable snapshot
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              A trust summary your team can reuse
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/64">
              Copy the current privacy posture as structured JSON for vendor review, internal notes, or client-facing documentation.
            </p>
            <button
              type="button"
              onClick={() => void copySnapshot()}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white px-4 text-sm font-bold text-black transition hover:bg-cyan-100"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Snapshot copied" : "Copy JSON snapshot"}
            </button>
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                <Code2 className="h-4 w-4 text-cyan-100" aria-hidden />
                Privacy posture JSON
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1 text-xs font-bold text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Current version
              </div>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded-xl border border-white/10 bg-black/34 p-4 text-xs leading-6 text-white/68 sm:text-sm">
              {snapshotText}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
