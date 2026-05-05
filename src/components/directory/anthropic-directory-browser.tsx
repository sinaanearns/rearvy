"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, LayoutGrid, Plug, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  AnthropicDirectoryCatalog,
  AnthropicDirectoryCategory,
  AnthropicDirectorySource,
} from "@/lib/anthropic-directory";

type SourceFilter = "all" | AnthropicDirectorySource;
type SortOption = "recommended" | "name-asc" | "name-desc" | "installs-desc";

const SECTION_META: Record<
  AnthropicDirectoryCategory,
  {
    label: string;
    description: string;
    icon: typeof Sparkles;
    accent: string;
  }
> = {
  skills: {
    label: "Skills",
    description: "Built-in workflows and official skill bundles.",
    icon: Sparkles,
    accent: "from-cyan-500/15 via-blue-500/10 to-sky-500/5",
  },
  connectors: {
    label: "Connectors",
    description: "Anthropic directory entries that connect Claude to apps and services.",
    icon: Plug,
    accent: "from-emerald-500/15 via-teal-500/10 to-cyan-500/5",
  },
  plugins: {
    label: "Plugins",
    description: "Bundles of skills, tools, and workflows from Anthropic and partners.",
    icon: LayoutGrid,
    accent: "from-amber-500/15 via-orange-500/10 to-rose-500/5",
  },
};

function formatInstallCount(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function AnthropicDirectoryBrowser({ directory }: { directory: AnthropicDirectoryCatalog }) {
  const [activeSection, setActiveSection] = useState<AnthropicDirectoryCategory>("connectors");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const deferredSearch = useDeferredValue(searchQuery);

  const collator = useMemo(() => new Intl.Collator(undefined, { sensitivity: "base" }), []);

  const visibleItems = useMemo(() => {
    const normalizedSearch = normalizeSearch(deferredSearch);
    const currentItems = directory[activeSection];

    const filtered = currentItems.filter((item) => {
      if (sourceFilter !== "all" && item.source !== sourceFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [item.title, item.description, item.slug].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    });

    return filtered.sort((left, right) => {
      switch (sortBy) {
        case "name-asc":
          return collator.compare(left.title, right.title);
        case "name-desc":
          return collator.compare(right.title, left.title);
        case "installs-desc": {
          const leftInstalls = left.installs ?? -1;
          const rightInstalls = right.installs ?? -1;
          if (leftInstalls !== rightInstalls) {
            return rightInstalls - leftInstalls;
          }
          return collator.compare(left.title, right.title);
        }
        default:
          return left.rank - right.rank || collator.compare(left.title, right.title);
      }
    });
  }, [activeSection, collator, deferredSearch, directory, sortBy, sourceFilter]);

  const activeMeta = SECTION_META[activeSection];
  const activeItems = directory[activeSection];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {(["skills", "connectors", "plugins"] as AnthropicDirectoryCategory[]).map((section) => {
          const meta = SECTION_META[section];
          const Icon = meta.icon;
          const isActive = section === activeSection;

          return (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={cn(
                "w-full rounded-3xl border p-4 text-left transition-all",
                isActive
                  ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/5"
                  : "border-border/70 bg-background/80 hover:border-border hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl border",
                      isActive
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted/60 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold tracking-tight">{meta.label}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
                <Badge variant={isActive ? "default" : "secondary"}>{directory[section].length}</Badge>
              </div>
            </button>
          );
        })}

        <Card className="rounded-3xl border-border/70 bg-background/80 shadow-sm">
          <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <BadgeCheck className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Official Anthropic catalog</span>
            </div>
            <p className="leading-6">
              Skills are seeded from official Claude Code capabilities and skill-focused bundles.
              Connectors and plugins are pulled from Anthropic&apos;s public directory pages.
            </p>
          </CardContent>
        </Card>

        <Link href="/integrations" className="block">
          <Card className="rounded-3xl border-border/70 bg-background/80 shadow-sm transition-colors hover:border-border hover:bg-muted/40">
            <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <Plug className="h-4 w-4 text-cyan-500" />
                <span className="font-medium">Integrations hub</span>
              </div>
              <p className="leading-6">
                Manage connected apps, data sources, and sync settings without leaving the directory.
              </p>
              <div className="flex items-center gap-1 text-sm font-medium text-primary">
                Open integrations
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </aside>

      <section className="space-y-4">
        <Card className={cn("overflow-hidden border-border/70 bg-background/90 shadow-sm", `bg-gradient-to-br ${activeMeta.accent}`)}>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Browse Anthropic</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{activeMeta.label}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{activeMeta.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {activeItems.length} items
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Live Anthropic pages
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`Search ${activeMeta.label.toLowerCase()}...`}
                  className="h-10 rounded-2xl border-border/70 bg-background pl-9"
                />
              </div>

              <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as SourceFilter)}>
                <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filter by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="Anthropic">Anthropic</SelectItem>
                  <SelectItem value="Anthropic verified">Anthropic verified</SelectItem>
                  <SelectItem value="Partners">Partners</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="name-asc">Name: A to Z</SelectItem>
                  <SelectItem value="name-desc">Name: Z to A</SelectItem>
                  <SelectItem value="installs-desc">Most installed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
          <p>
            Showing <span className="font-medium text-foreground">{visibleItems.length}</span> of{" "}
            <span className="font-medium text-foreground">{activeItems.length}</span> {activeMeta.label.toLowerCase()}.
          </p>
          <p className="hidden sm:block">
            {sourceFilter === "all" ? "All sources" : sourceFilter}
          </p>
        </div>

        {visibleItems.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => {
              const installs = formatInstallCount(item.installs);

              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group block h-full"
                >
                  <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-border/70 bg-card/95 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
                    <CardHeader className="space-y-3 p-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="truncate text-base leading-6">{item.title}</CardTitle>
                          <CardDescription className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="shrink-0 rounded-full">
                          {item.kind === "skills" ? "Skill" : activeMeta.label.slice(0, -1)}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="mt-auto flex items-end justify-between gap-4 p-4 pt-0 text-xs text-muted-foreground">
                      <div className="min-w-0 space-y-2">
                        <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
                          {item.slug}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                            {item.source}
                          </Badge>
                          {installs ? (
                            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px]">
                              {installs} installs
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        ) : (
          <Card className="rounded-3xl border-dashed border-border/70 bg-background/80">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <BadgeCheck className="h-8 w-8 text-muted-foreground/60" />
              <div>
                <p className="font-medium">No results match this filter.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try clearing the search, switching source filters, or browsing a different category.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setSearchQuery("");
                  setSourceFilter("all");
                  setSortBy("recommended");
                }}
              >
                Reset filters
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
