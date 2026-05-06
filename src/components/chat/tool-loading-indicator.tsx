"use client";

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
  prepareGmailMessage: "Preparing Gmail draft...",
  selectOperationsCapability: "Selecting chat capability...",
};

export function ToolLoadingIndicator({
  toolName,
}: ToolLoadingIndicatorProps) {
  const label = toolName
    ? toolLabels[toolName] || "Thinking..."
    : "Thinking...";

  return (
    <div className="mx-auto flex w-full max-w-4xl px-2 sm:px-4">
      <div className="flex flex-col gap-2 pt-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div
          className="relative h-16 w-[min(24rem,82vw)] overflow-hidden rounded-2xl border border-border/60 bg-background/35 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
          role="status"
          aria-label={label}
        >
          <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.16),transparent)] opacity-70 animate-[pulse_1.8s_ease-in-out_infinite]" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />
          <div className="relative flex h-full flex-col justify-center gap-2.5 px-4">
            <span className="h-2.5 w-24 rounded-full bg-foreground/10 dark:bg-white/12" />
            <span className="h-2.5 w-40 rounded-full bg-foreground/[0.07] dark:bg-white/[0.08]" />
          </div>
        </div>
      </div>
    </div>
  );
}
