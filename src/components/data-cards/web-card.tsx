"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, FileText, Search } from "lucide-react";

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
      <Card className="w-full max-w-2xl border-border/70 bg-card/90">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-muted-foreground" />
            Web Search
          </CardTitle>
          {query ? (
            <p className="text-sm text-muted-foreground">Query: {query}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          {results.map((result, index) => (
            <div key={`${result.url}-${index}`} className="space-y-1 rounded-xl border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {result.title || result.url || "Untitled result"}
                  </p>
                  {result.source ? (
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {result.source}
                    </p>
                  ) : null}
                </div>
                {result.url ? (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              {result.snippet ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {result.snippet}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (content || title || url) {
    const preview =
      content.length > 480 ? `${content.slice(0, 480).trim()}...` : content;

    return (
      <Card className="w-full max-w-2xl border-border/70 bg-card/90">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Web Page
          </CardTitle>
          {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {url}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          {preview ? (
            <p className="text-sm leading-6 text-foreground/90">{preview}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/70 bg-card/90">
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">
          {message || "No web data available."}
        </p>
      </CardContent>
    </Card>
  );
}
