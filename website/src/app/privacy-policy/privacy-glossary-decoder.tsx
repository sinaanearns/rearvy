"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Search, X } from "lucide-react";

type GlossaryItem = {
  term: string;
  meaning: string;
};

type PrivacyGlossaryDecoderProps = {
  items: GlossaryItem[];
};

export function PrivacyGlossaryDecoder({ items }: PrivacyGlossaryDecoderProps) {
  const [query, setQuery] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(items[0]?.term ?? "");
  const [copied, setCopied] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) =>
      [item.term, item.meaning].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [items, normalizedQuery]);
  const selectedItem = items.find((item) => item.term === selectedTerm) ?? visibleItems[0] ?? items[0];

  async function copyDefinition() {
    if (!selectedItem) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`${selectedItem.term}: ${selectedItem.meaning}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id="privacy-glossary" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-black/42 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.62fr_1.38fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Plain language</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Privacy decoder
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/62">
              Search policy terms, select a definition, and copy the plain-language version for notes or vendor
              reviews.
            </p>

            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Selected term</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {selectedItem?.term ?? "No term selected"}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/64">
                {selectedItem?.meaning ?? "Try a different search to find a glossary entry."}
              </p>
              <button
                type="button"
                onClick={() => void copyDefinition()}
                disabled={!selectedItem}
                className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-cyan-100/24 bg-cyan-200/12 px-4 py-2 text-sm font-bold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-cyan-200/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Copied" : "Copy definition"}
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <label className="relative block">
              <span className="sr-only">Search privacy glossary</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search token, retention, provider, anonymize..."
                className="min-h-12 w-full rounded-lg border border-white/12 bg-white/8 px-11 pr-12 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-cyan-200/50 focus:bg-white/10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/30 text-white/60 transition hover:text-white"
                  aria-label="Clear privacy glossary search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </label>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {visibleItems.map((item) => {
                const isSelected = item.term === selectedItem?.term;

                return (
                  <button
                    key={item.term}
                    type="button"
                    onClick={() => setSelectedTerm(item.term)}
                    className={[
                      "rounded-lg border p-4 text-left transition",
                      isSelected
                        ? "border-cyan-200/38 bg-cyan-200/12 shadow-[0_14px_42px_rgba(34,211,238,0.12)]"
                        : "border-white/10 bg-white/6 hover:border-cyan-200/28 hover:bg-cyan-200/8",
                    ].join(" ")}
                    aria-pressed={isSelected}
                  >
                    <p className="text-base font-semibold tracking-tight text-white">{item.term}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/58">{item.meaning}</p>
                  </button>
                );
              })}

              {visibleItems.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white/58 md:col-span-2">
                  No glossary term matched. Try token, retention, anonymize, provider, AI, or personal information.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
