"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, LifeBuoy, Search, X } from "lucide-react";

import { buildMailto, PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

type PrivacyFaq = {
  question: string;
  answer: string;
};

type PrivacyFaqConsoleProps = {
  faqs: PrivacyFaq[];
};

const quickTopics = ["sell", "integration", "deletion", "AI"];

export function PrivacyFaqConsole({ faqs }: PrivacyFaqConsoleProps) {
  const [query, setQuery] = useState("");
  const [openQuestion, setOpenQuestion] = useState(faqs[0]?.question ?? "");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleFaqs = useMemo(() => {
    if (!normalizedQuery) {
      return faqs;
    }

    return faqs.filter((faq) =>
      [faq.question, faq.answer].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [faqs, normalizedQuery]);

  return (
    <section id="privacy-faq" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-black/42 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.62fr_1.38fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Fast answers</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Privacy FAQ console
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/62">
              Search the questions people usually check before reading the full policy, then expand the answer you
              need.
            </p>

            <div className="mt-6 rounded-lg border border-cyan-100/16 bg-cyan-200/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" aria-hidden />
                <p className="text-sm leading-6 text-white/66">
                  Answers here mirror the policy content and the structured FAQ data used for search previews.
                </p>
              </div>
            </div>

            <a
              href={buildMailto(PRIVACY_CONTACT_EMAIL)}
              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:border-white/28 hover:bg-white hover:text-black"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden />
              Ask privacy support
            </a>
          </div>

          <div className="p-5 sm:p-7">
            <label className="relative block">
              <span className="sr-only">Search privacy FAQ</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sales, integrations, deletion, AI..."
                className="min-h-12 w-full rounded-lg border border-white/12 bg-white/8 px-11 pr-12 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-cyan-200/50 focus:bg-white/10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/30 text-white/60 transition hover:text-white"
                  aria-label="Clear privacy FAQ search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setQuery(topic)}
                  className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-bold text-white/58 transition hover:border-cyan-200/28 hover:bg-cyan-200/10 hover:text-white"
                >
                  {topic}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/38">
                <span>{visibleFaqs.length} answers</span>
                <span>{normalizedQuery ? `Query: ${query}` : "All topics"}</span>
              </div>

              <div className="grid gap-2">
                {visibleFaqs.map((faq) => {
                  const isOpen = openQuestion === faq.question;

                  return (
                    <article key={faq.question} className="rounded-lg border border-white/10 bg-black/20">
                      <button
                        type="button"
                        onClick={() => setOpenQuestion(isOpen ? "" : faq.question)}
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                        aria-expanded={isOpen}
                      >
                        <span className="text-base font-semibold tracking-tight text-white">{faq.question}</span>
                        <ChevronDown
                          className={[
                            "h-4 w-4 shrink-0 text-cyan-100 transition",
                            isOpen ? "rotate-180" : "",
                          ].join(" ")}
                          aria-hidden
                        />
                      </button>
                      {isOpen ? (
                        <div className="border-t border-white/10 px-4 pb-4 pt-3">
                          <p className="text-sm leading-6 text-white/64">{faq.answer}</p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}

                {visibleFaqs.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/58">
                    No matching FAQ. Try sales, integration, deletion, AI, account, or support.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
