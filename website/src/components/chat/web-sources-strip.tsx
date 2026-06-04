"use client";

import { ChevronDown, ExternalLink, Globe } from "lucide-react";

export type WebSourceItem = {
  title: string;
  url: string;
  source: string;
  snippet?: string;
};

interface WebSourcesStripProps {
  sources: WebSourceItem[];
  query?: string | null;
}

export function WebSourcesStrip({
  sources,
  query,
}: WebSourcesStripProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <details className="group w-full max-w-2xl rounded-[8px] border border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Sources</span>
          <span className="rounded-[8px] border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            {sources.length}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden max-w-[20rem] items-center gap-1 overflow-hidden sm:flex">
            {sources.slice(0, 3).map((source) => (
              <span
                key={source.url}
                className="truncate rounded-[8px] border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {source.source}
              </span>
            ))}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="space-y-3 border-t border-border/60 px-4 py-3">
        {query ? (
          <p className="text-xs text-muted-foreground">
            Searched the web for: {query}
          </p>
        ) : null}

        <div className="space-y-2">
          {sources.slice(0, 5).map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[8px] border border-border/60 bg-background/50 p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {source.title}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {source.source}
                  </p>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>

              {source.snippet ? (
                <p className="mt-2 max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">
                  {source.snippet}
                </p>
              ) : null}
            </a>
          ))}
        </div>
      </div>
    </details>
  );
}
