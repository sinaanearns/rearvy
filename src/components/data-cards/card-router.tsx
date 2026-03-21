"use client";

import type { ComponentProps } from "react";
import { RevenueCard } from "./revenue-card";
import { OrdersCard } from "./orders-card";
import { ProductsCard } from "./products-card";
import { InventoryCard } from "./inventory-card";
import { ComparisonCard } from "./comparison-card";
import { CustomerCard } from "./customer-card";
import { InstagramCard } from "./instagram-card";
import { ReviewsCard } from "./reviews-card";
import { GenericMetricCard } from "./generic-metric-card";
import { WebCard } from "./web-card";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface CardRouterProps {
    toolName: string;
    state: string;
    output?: unknown;
}

type RevenueCardData = ComponentProps<typeof RevenueCard>["data"];
type OrdersCardData = ComponentProps<typeof OrdersCard>["data"];
type ProductsCardData = ComponentProps<typeof ProductsCard>["data"];
type InventoryCardData = ComponentProps<typeof InventoryCard>["data"];
type ComparisonCardData = ComponentProps<typeof ComparisonCard>["data"];
type CustomerCardData = ComponentProps<typeof CustomerCard>["data"];
type InstagramCardData = ComponentProps<typeof InstagramCard>["data"];
type ReviewsCardData = ComponentProps<typeof ReviewsCard>["data"];

export function CardRouter({ toolName, state, output }: CardRouterProps) {
    const isEarlySchemaProviderTool = /tiktok|woo/i.test(toolName);

    if (state === "running" || state === "partial") {
        return (
            <Card className="w-full max-w-md border-dashed">
                <CardContent className="flex items-center justify-center p-6 bg-muted/20">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground italic">
                        Analyzing {toolName.replace(/^get/, "").replace(/([A-Z])/g, " $1").toLowerCase()}...
                    </span>
                </CardContent>
            </Card>
        );
    }

    if (state === "error") {
        return (
            <Card className="w-full max-w-md border-red-200 bg-red-50/20">
                <CardContent className="pt-4">
                    <p className="text-sm text-red-600 font-medium">Tool Error</p>
                    <p className="text-xs text-red-500 mt-1">
                        {typeof output === "string"
                            ? output
                            : typeof output === "object" &&
                                output !== null &&
                                "message" in output &&
                                typeof output.message === "string"
                              ? output.message
                              : "Something went wrong."}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const data =
        output && typeof output === "object"
            ? (output as Record<string, unknown>)
            : null;
    if (!data) {
        if (isEarlySchemaProviderTool) {
            return (
                <Card className="w-full max-w-md border-dashed">
                    <CardContent className="p-6 bg-muted/20">
                        <p className="text-sm font-medium">Coming Soon</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            This integration is connected, but dashboard cards for this channel are still rolling out.
                        </p>
                    </CardContent>
                </Card>
            );
        }
        return null;
    }

    if (data.status === "coming_soon" || data.status === "unsupported_schema") {
        return (
            <Card className="w-full max-w-md border-dashed">
                <CardContent className="p-6 bg-muted/20">
                    <p className="text-sm font-medium">Coming Soon</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {typeof data.message === "string"
                            ? data.message
                            : "This integration is connected, but this view is not yet available."}
                    </p>
                </CardContent>
            </Card>
        );
    }

    switch (toolName) {
        case "getRevenue":
        case "getRevenueBreakdown":
            return <RevenueCard data={data as RevenueCardData} />;
        case "getOrders":
        case "getOrderDetails":
            return <OrdersCard data={data as OrdersCardData} />;
        case "getTopProducts":
        case "getProductDetails":
            return <ProductsCard data={data as ProductsCardData} />;
        case "getInventoryStatus":
            return <InventoryCard data={data as InventoryCardData} />;
        case "comparePerformance":
            return <ComparisonCard data={data as ComparisonCardData} />;
        case "getCustomerMetrics":
            return <CustomerCard data={data as CustomerCardData} />;
        case "getInstagramAccountStats":
        case "getTopInstagramPosts":
        case "getInstagramPostPerformance":
        case "getInstagramComments":
            return <InstagramCard data={data as InstagramCardData} />;
        case "getProductReviews":
        case "getReviewSummary":
            return <ReviewsCard data={data as ReviewsCardData} />;
        case "searchWeb":
        case "fetchWebPage":
            return <WebCard data={data} />;
        default:
            return <GenericMetricCard data={data} toolName={toolName} />;
    }
}
