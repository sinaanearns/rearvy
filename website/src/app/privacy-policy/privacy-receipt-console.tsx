"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ReceiptText, ShieldCheck } from "lucide-react";

type ReceiptItem = {
  label: string;
  value: string;
  note: string;
};

type PrivacyReceiptConsoleProps = {
  items: ReceiptItem[];
};

export function PrivacyReceiptConsole({ items }: PrivacyReceiptConsoleProps) {
  const [selectedLabel, setSelectedLabel] = useState(items[0]?.label ?? "");
  const [copied, setCopied] = useState(false);
  const selectedItem = items.find((item) => item.label === selectedLabel) ?? items[0];
  const receiptText = useMemo(
    () =>
      [
        "Rearvy privacy receipt",
        ...items.map((item) => `- ${item.label}: ${item.value}. ${item.note}`),
      ].join("\n"),
    [items],
  );

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      document.querySelector("#privacy-snapshot")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <section id="privacy-receipt" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-white/7 backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.62fr_1.38fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-200/24 bg-cyan-200/10">
              <ReceiptText className="h-5 w-5 text-cyan-100" aria-hidden />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
              Privacy receipt
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              The short version, verified
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/64">
              Select a trust signal to inspect it, or copy the complete short receipt for a client, vendor, or
              internal review.
            </p>
            <button
              type="button"
              onClick={() => void copyReceipt()}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white px-4 text-sm font-bold text-black transition hover:bg-cyan-100"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Receipt copied" : "Copy receipt"}
            </button>
          </div>

          <div className="grid gap-4 p-5 sm:p-7 xl:grid-cols-[0.86fr_1.14fr]">
            <div className="grid gap-2">
              {items.map((item) => {
                const isSelected = item.label === selectedItem?.label;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSelectedLabel(item.label)}
                    className={[
                      "rounded-lg border p-4 text-left transition",
                      isSelected
                        ? "border-cyan-200/38 bg-cyan-200/12"
                        : "border-white/10 bg-white/6 hover:border-cyan-200/28 hover:bg-cyan-200/8",
                    ].join(" ")}
                    aria-pressed={isSelected}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-white">{item.value}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-cyan-100/16 bg-cyan-200/10 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-100/24 bg-black/24 text-cyan-50">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                    Selected signal
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {selectedItem?.label ?? "Privacy signal"}
                  </h3>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                    {selectedItem?.value ?? "Ready"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/64">{selectedItem?.note}</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Receipt format</p>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-6 text-white/62">
                  {receiptText}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
