"use client";

import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatTokenUsageMetadata } from "@/lib/ai/token-usage";

function formatTokens(value: number) {
  if (value >= 1_000_000) {
    const formatted = value / 1_000_000;
    return `${formatted >= 10 ? formatted.toFixed(0) : formatted.toFixed(1)}M`;
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1000)}K`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toLocaleString();
}

function getUsageTone(usedPercent: number) {
  if (usedPercent >= 90) {
    return "bg-rose-500";
  }

  if (usedPercent >= 75) {
    return "bg-amber-500";
  }

  return "bg-emerald-500";
}

export function TokenUsageMeter({
  usage,
  className,
}: {
  usage: ChatTokenUsageMetadata;
  className?: string;
}) {
  const usedTokens = Math.max(0, usage.totalTokens);
  const contextWindowTokens = Math.max(1, usage.contextWindowTokens);
  const remainingTokens = Math.max(0, usage.remainingTokens);
  const usedPercent = Math.min(
    100,
    Math.max(0, (usedTokens / contextWindowTokens) * 100)
  );
  const exactLabel = usage.source === "provider" ? "Last turn" : "Context";

  return (
    <div
      className={cn("mx-auto w-full max-w-5xl px-1", className)}
      title={`${formatTokens(remainingTokens)} tokens available out of ${formatTokens(
        contextWindowTokens
      )}. Max response: ${formatTokens(usage.maxOutputTokens)} tokens.`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground/85">
          <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{exactLabel} tokens</span>
        </span>
        <span className="whitespace-nowrap">{formatTokens(usedTokens)} used</span>
        <span className="whitespace-nowrap text-emerald-600 dark:text-emerald-300">
          {formatTokens(remainingTokens)} available
        </span>
        <span className="whitespace-nowrap">of {formatTokens(contextWindowTokens)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
        <div
          className={cn("h-full rounded-full transition-all", getUsageTone(usedPercent))}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
    </div>
  );
}
