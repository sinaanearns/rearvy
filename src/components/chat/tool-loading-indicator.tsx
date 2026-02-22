"use client";

import { Skeleton } from "@/components/ui/skeleton";
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
};

export function ToolLoadingIndicator({
  toolName,
}: ToolLoadingIndicatorProps) {
  const label = toolName
    ? toolLabels[toolName] || "Thinking..."
    : "Thinking...";

  return (
    <div className="flex gap-3 max-w-3xl mx-auto">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
        <Sparkles className="h-4 w-4 text-primary-foreground animate-pulse" />
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground animate-pulse">{label}</p>
        <Skeleton className="h-20 w-64 rounded-xl" />
      </div>
    </div>
  );
}
