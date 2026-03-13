"use client";

import { Sparkles } from "lucide-react";

interface ToolLoadingIndicatorProps {
  toolName?: string;
}

const toolLabels: Record<string, string> = {
  getRevenue: "Looking up revenue...",
  getRevenueBreakdown: "Breaking down revenue...",
  getOrders: "Fetching orders...",
  getOrderDetails: "Looking up order...",
  getTopProducts: "Finding top products...",
  getProductDetails: "Looking up product...",
  getInventoryStatus: "Checking inventory...",
  comparePerformance: "Comparing periods...",
  getCustomerMetrics: "Analyzing customers...",
  searchMemories: "Searching memory...",
  saveMemory: "Saving to memory...",
  getRecentInsights: "Loading insights...",
  getIntegrationStatus: "Checking integrations...",
  getCurrentDate: "Checking date...",
  searchWeb: "Searching the web...",
  fetchWebPage: "Opening source page...",
};

export function ToolLoadingIndicator({
  toolName,
}: ToolLoadingIndicatorProps) {
  const label = toolName
    ? toolLabels[toolName] || "Thinking..."
    : "Thinking...";

  return (
    <div className="mx-auto flex w-full max-w-4xl gap-4 px-2 sm:px-4">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card/80 shadow-sm">
        <Sparkles className="h-4 w-4 animate-pulse text-foreground" />
      </div>
      <div className="flex flex-col gap-3 pt-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-2 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-foreground/35 animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-foreground/55 animate-pulse [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-foreground/75 animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
