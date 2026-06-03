"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

type PrivacySectionLink = {
  href: string;
  label: string;
  detail: string;
  group: string;
};

type PrivacySectionFinderProps = {
  links: PrivacySectionLink[];
};

const quickFilters = ["deletion", "integration", "AI", "access"];

export function PrivacySectionFinder({ links }: PrivacySectionFinderProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const groupedLinks = useMemo(() => {
    return links.reduce<Array<{ group: string; items: PrivacySectionLink[] }>>((groups, link) => {
      const currentGroup = groups.find((group) => group.group === link.group);
      if (currentGroup) {
        currentGroup.items.push(link);
      } else {
        groups.push({ group: link.group, items: [link] });
      }
      return groups;
    }, []);
  }, [links]);
  const results = useMemo(() => {
    return links
      .filter((link) =>
        [link.label, link.detail, link.group].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
      .slice(0, 8);
  }, [links, normalizedQuery]);
  const isSearching = Boolean(normalizedQuery);

  return (
    <section className="mx-auto mt-6 w-full max-w-[1180px] px-6">
      <div className="rounded-xl border border-white/12 bg-black/42 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/75">
              Section finder
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Find the privacy answer fast
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Search the trust center by topic, action, or data area.
            </p>
          </div>

          <div>
            <label className="relative block">
              <span className="sr-only">Search privacy sections</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search deletion, integrations, AI, export..."
                className="min-h-12 w-full rounded-lg border border-white/12 bg-white/8 px-11 pr-12 text-sm font-semibold text-white outline-none transition placeholder:text-white/34 focus:border-cyan-200/50 focus:bg-white/10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/30 text-white/60 transition hover:text-white"
                  aria-label="Clear privacy search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setQuery(filter)}
                  className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-bold text-white/58 transition hover:border-cyan-200/28 hover:bg-cyan-200/10 hover:text-white"
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {isSearching ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/42 sm:col-span-2">
                  <span>{results.length} matches</span>
                  <span>Query: {query}</span>
                </div>
              ) : null}

              {isSearching && results.length > 0 ? (
                results.map((link) => (
                  <a
                    key={`${link.group}-${link.href}`}
                    href={link.href}
                    className="rounded-lg border border-white/10 bg-white/6 p-3 transition hover:border-cyan-200/30 hover:bg-cyan-200/8"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{link.label}</p>
                      <span className="rounded-full border border-white/10 bg-black/22 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/38">
                        {link.group}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/52">{link.detail}</p>
                  </a>
                ))
              ) : null}

              {isSearching && results.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/6 p-4 text-sm leading-6 text-white/58 sm:col-span-2">
                  No matching section. Try deletion, integrations, AI, access, rights, or policy.
                </div>
              ) : null}

              {!isSearching
                ? groupedLinks.map((group) => (
                    <div key={group.group} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                        {group.group}
                      </p>
                      <div className="mt-3 grid gap-2">
                        {group.items.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            className="rounded-md border border-white/8 bg-black/18 px-3 py-2 transition hover:border-cyan-200/28 hover:bg-cyan-200/8"
                          >
                            <p className="text-sm font-semibold text-white">{link.label}</p>
                            <p className="mt-1 text-xs leading-5 text-white/46">{link.detail}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
