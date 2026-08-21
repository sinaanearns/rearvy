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
  generateDocument: "Creating document files...",
};

export function ToolLoadingIndicator({
  toolName,
}: ToolLoadingIndicatorProps) {
  const label = toolName
    ? toolLabels[toolName] || "Thinking..."
    : "Thinking...";

  return (
    <div className="mx-auto flex w-full max-w-4xl gap-4 px-2 sm:px-4">
      <p className="pt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
