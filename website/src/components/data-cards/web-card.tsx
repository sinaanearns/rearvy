"use client";

import { ExternalLink, FileText, Search } from "lucide-react";

import { DataCardFrame, DataCardMessage } from "./data-card-frame";

type SearchResultItem = {
  title?: string;
  url?: string;
  snippet?: string;
  source?: string;
};

interface WebCardProps {
  data: Record<string, unknown>;
}

function isSearchResultItem(value: unknown): value is SearchResultItem {
  return Boolean(value && typeof value === "object");
}

export function WebCard({ data }: WebCardProps) {
  const results = Array.isArray(data.results)
    ? data.results.filter(isSearchResultItem).slice(0, 4)
    : [];

  const content = typeof data.content === "string" ? data.content : "";
  const title = typeof data.title === "string" ? data.title : null;
  const url = typeof data.url === "string" ? data.url : null;
  const query = typeof data.query === "string" ? data.query : null;
  const message = typeof data.message === "string" ? data.message : null;

  if (results.length > 0) {
    return (
      <DataCardFrame
        icon={Search}
        title="Web search"
        subtitle={query ? `Query: ${query}` : "Search results"}
        tone="cyan"
        className="max-w-2xl"
      >
        {message ? (
          <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
            {message}
          </div>
        ) : null}
        <div className="space-y-3">
          {results.map((result, index) => (
            <div
              key={`${result.url}-${index}`}
              className="rounded-[8px] border border-border/70 bg-background/78 p-3 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 text-sm font-semibold text-foreground">
                    {result.title || result.url || "Untitled result"}
                  </p>
                  {result.source ? (
                    <p className="text-xs font-medium text-muted-foreground">
                      {result.source}
                    </p>
                  ) : null}
                </div>
                {result.url ? (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-[8px] p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Open search result"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              {result.snippet ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {result.snippet}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </DataCardFrame>
    );
  }

  if (content || title || url) {
    const preview =
      content.length > 480 ? `${content.slice(0, 480).trim()}...` : content;

    return (
      <DataCardFrame
        icon={FileText}
        title="Web page"
        subtitle={title || url || "Fetched page"}
        tone="cyan"
        className="max-w-2xl"
      >
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-[8px] border border-border/70 bg-background/78 px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]"
          >
            <span className="truncate">{url}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </a>
        ) : null}
        {message ? (
          <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
            {message}
          </div>
        ) : null}
        {preview ? (
          <p className="rounded-[8px] border border-border/70 bg-background/78 p-3 text-sm leading-6 text-foreground/90 dark:border-white/10 dark:bg-white/[0.04]">
            {preview}
          </p>
        ) : null}
      </DataCardFrame>
    );
  }

  return (
    <DataCardMessage
      icon={Search}
      message={message || "No web data available."}
      title="Web note"
      tone="cyan"
    />
  );
}
