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
  searchBrowserCredentials: "Checking saved browser credentials...",
  runBrowserTask: "Using the browser...",
  controlBrowserSession: "Continuing in the browser...",
};

export function ToolLoadingIndicator({
  toolName,
}: ToolLoadingIndicatorProps) {
  const label = toolName
    ? toolLabels[toolName] || "Thinking..."
    : "Thinking...";

  return (
    <div className="mx-auto flex w-full max-w-4xl gap-4 px-2 sm:px-4">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-500/35 bg-slate-500/10 shadow-sm shadow-slate-950/20">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-200 animate-pulse">
          R
        </span>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="inline-flex h-9 w-fit items-center gap-2 rounded-full border border-slate-500/15 bg-slate-500/10 px-3 py-1.5 shadow-sm backdrop-blur-sm">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300/80">
            Rearvy
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-400/35" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300/55 animate-[bounce_1s_infinite_0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300/70 animate-[bounce_1s_infinite_200ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-200/85 animate-[bounce_1s_infinite_400ms]" />
        </div>
      </div>
    </div>
  );
}
