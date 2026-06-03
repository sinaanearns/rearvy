"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Fingerprint,
  LockKeyhole,
  Mail,
  RotateCcw,
  Search,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

type PolicySection = {
  title: string;
  iconKey: string;
  body: string[];
  highlight?: boolean;
};

type PrivacyPolicyReaderProps = {
  sections: PolicySection[];
};

function sectionId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const SECTION_ICONS = {
  badgeCheck: BadgeCheck,
  fingerprint: Fingerprint,
  lockKeyhole: LockKeyhole,
  mail: Mail,
  rotateCcw: RotateCcw,
  serverCog: ServerCog,
  shieldCheck: ShieldCheck,
  slidersHorizontal: SlidersHorizontal,
  sparkles: Sparkles,
  trash2: Trash2,
  userCheck: UserCheck,
};

function getSectionIcon(iconKey: string) {
  return SECTION_ICONS[iconKey as keyof typeof SECTION_ICONS] ?? Fingerprint;
}

export function PrivacyPolicyReader({ sections }: PrivacyPolicyReaderProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) {
      return sections;
    }

    return sections.filter((section) =>
      [section.title, ...section.body].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery, sections]);

  return (
    <section id="privacy-policy-index" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="mb-5 overflow-hidden rounded-xl border border-white/12 bg-black/42 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.62fr_1.38fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Legal map</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Full policy reader
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/62">
              Search the complete policy, jump to exact sections, and keep the original legal text visible below.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Sections</p>
                <p className="mt-2 text-2xl font-semibold text-white">{sections.length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Matches</p>
                <p className="mt-2 text-2xl font-semibold text-white">{visibleSections.length}</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <label className="relative block">
              <span className="sr-only">Search full privacy policy</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search retention, deletion, AI, sharing, children..."
                className="min-h-12 w-full rounded-lg border border-white/12 bg-white/8 px-11 pr-12 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-cyan-200/50 focus:bg-white/10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/30 text-white/60 transition hover:text-white"
                  aria-label="Clear full privacy policy search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </label>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSections.map((section) => {
                const Icon = getSectionIcon(section.iconKey);

                return (
                  <a
                    key={section.title}
                    href={`#${sectionId(section.title)}`}
                    className={[
                      "rounded-lg border px-4 py-3 transition",
                      section.highlight
                        ? "border-cyan-200/28 bg-cyan-200/10 text-white hover:border-cyan-100/50"
                        : "border-white/10 bg-white/6 text-white/70 hover:border-cyan-200/30 hover:bg-cyan-200/8 hover:text-white",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-cyan-100" aria-hidden />
                      <span className="text-sm font-semibold">{section.title}</span>
                    </span>
                  </a>
                );
              })}

              {visibleSections.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white/58 sm:col-span-2 lg:col-span-3">
                  No legal section matched. Try deletion, retention, sharing, AI, security, contact, or rights.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <aside className="rounded-xl border border-white/12 bg-white/7 p-5 backdrop-blur-xl lg:sticky lg:top-28 lg:h-fit">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/48">Policy index</p>
          <div className="mt-4 grid gap-2">
            {sections.map((section) => (
              <a
                key={section.title}
                href={`#${sectionId(section.title)}`}
                className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm font-medium text-white/70 transition hover:border-cyan-200/30 hover:bg-cyan-200/8 hover:text-white"
              >
                {section.title}
              </a>
            ))}
          </div>
        </aside>

        <div className="grid gap-5">
          {sections.map((section) => {
            const Icon = getSectionIcon(section.iconKey);
            const id = sectionId(section.title);

            return (
              <article
                id={id}
                key={section.title}
                className={
                  section.highlight
                    ? "scroll-mt-28 rounded-xl border border-cyan-200/26 bg-cyan-200/10 p-5 shadow-[0_18px_70px_rgba(34,211,238,0.08)]"
                    : "scroll-mt-28 rounded-xl border border-white/10 bg-white/6 p-5"
                }
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-black/30">
                    <Icon className="h-5 w-5 text-cyan-100" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-white">{section.title}</h2>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
