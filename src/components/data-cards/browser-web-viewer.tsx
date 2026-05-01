"use client";

import { useEffect, useState } from "react";
import { Globe, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BrowserWebViewerProps {
  url?: string | null;
  title?: string | null;
  className?: string;
}

export function BrowserWebViewer({
  url,
  title,
  className,
}: BrowserWebViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState(url);

  useEffect(() => {
    if (url) {
      setDisplayUrl(url);
      setError(null);
    }
  }, [url]);

  const safeUrl = displayUrl
    ? displayUrl.startsWith("http")
      ? displayUrl
      : `https://${displayUrl}`
    : null;

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError(
      "Could not load website. This may be due to CORS restrictions or if the site blocks embedding."
    );
  };

  if (!safeUrl) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border/40 bg-muted/20 p-8 text-center", className)}>
        <Globe className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No website URL available</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="min-w-0">
            {title && (
              <p className="text-xs font-medium text-foreground truncate">{title}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">{safeUrl}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          asChild
        >
          <a href={safeUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            <span className="ml-1.5">Open</span>
          </a>
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
          <p className="text-sm text-amber-900 dark:text-amber-400">
            {error}
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-500/90">
            Click "Open" button to view in a new window.
          </p>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden rounded-lg border border-border/50 bg-white shadow-sm">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
            </div>
          )}
          <iframe
            key={safeUrl}
            src={safeUrl}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={title || "Website preview"}
            className="w-full bg-white"
            style={{
              height: "min(600px, 80vh)",
              border: "none",
            }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      )}
    </div>
  );
}
