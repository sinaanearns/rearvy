"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GenericMetricCard } from "./generic-metric-card";
import { RevenueCard } from "./revenue-card";
import { ProductsCard } from "./products-card";
import { OrdersCard } from "./orders-card";
import { ComparisonCard } from "./comparison-card";
import { InventoryCard } from "./inventory-card";
import { CustomerCard } from "./customer-card";
import { InstagramCard } from "./instagram-card";
import { TikTokCard } from "./tiktok-card";
import { ReviewsCard } from "./reviews-card";
import { ActionCard } from "./action-card";

interface CardRouterProps {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
}

export function CardRouter({ toolName, state, output }: CardRouterProps) {
  // Still loading / executing
  if (state !== "output-available") {
    const toolLabels: Record<string, string> = {
      getRevenue: "Looking up revenue...",
      getRevenueBreakdown: "Breaking down revenue...",
      getOrders: "Fetching orders...",
      getTopProducts: "Finding top products...",
      getInventoryStatus: "Checking inventory...",
      comparePerformance: "Comparing periods...",
      getCustomerMetrics: "Analyzing customers...",
      getInstagramAccountStats: "Fetching Instagram stats...",
      getTopInstagramPosts: "Finding top Instagram posts...",
      getInstagramPostPerformance: "Analyzing Instagram post...",
      getInstagramComments: "Loading Instagram comments...",
      getTikTokAccountStats: "Fetching TikTok stats...",
      getTopTikTokVideos: "Finding top TikTok videos...",
      getTikTokVideoPerformance: "Analyzing TikTok video...",
      getProductReviews: "Loading product reviews...",
      getReviewSummary: "Summarizing reviews...",
      triggerDataSync: "Starting data sync...",
      createProject: "Creating project...",
      exportData: "Preparing export...",
      manageInsights: "Updating insights...",
      deleteMemory: "Deleting memory...",
    };

    return (
      <div className="w-full max-w-md space-y-2">
        <p className="text-xs text-muted-foreground animate-pulse">
          {toolLabels[toolName] || "Working..."}
        </p>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = output as any;

  // Skip rendering cards for utility tools
  if (
    toolName === "saveMemory" ||
    toolName === "getCurrentDate" ||
    toolName === "getIntegrationStatus" ||
    toolName === "searchMemories" ||
    toolName === "triggerDataSync" ||
    toolName === "manageInsights" ||
    toolName === "deleteMemory"
  ) {
    return null;
  }

  switch (toolName) {
    case "getRevenue":
    case "getRevenueBreakdown":
      return <RevenueCard data={data} />;
    case "getTopProducts":
    case "getProductDetails":
      return <ProductsCard data={data} />;
    case "getOrders":
    case "getOrderDetails":
      return <OrdersCard data={data} />;
    case "comparePerformance":
      return <ComparisonCard data={data} />;
    case "getInventoryStatus":
      return <InventoryCard data={data} />;
    case "getCustomerMetrics":
      return <CustomerCard data={data} />;
    case "getInstagramAccountStats":
    case "getTopInstagramPosts":
    case "getInstagramPostPerformance":
    case "getInstagramComments":
      return <InstagramCard data={data} />;
    case "getTikTokAccountStats":
    case "getTopTikTokVideos":
    case "getTikTokVideoPerformance":
      return <TikTokCard data={data} />;
    case "getProductReviews":
    case "getReviewSummary":
      return <ReviewsCard data={data} />;
    case "createProject":
    case "exportData":
      return <ActionCard data={data} toolName={toolName} />;
    default:
      return <GenericMetricCard data={data} toolName={toolName} />;
  }
}
