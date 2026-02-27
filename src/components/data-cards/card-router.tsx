"use client";

import { RevenueCard } from "./revenue-card";
import { OrdersCard } from "./orders-card";
import { ProductsCard } from "./products-card";
import { InventoryCard } from "./inventory-card";
import { ComparisonCard } from "./comparison-card";
import { CustomerCard } from "./customer-card";
import { InstagramCard } from "./instagram-card";
import { ReviewsCard } from "./reviews-card";
import { GenericMetricCard } from "./generic-metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface CardRouterProps {
    toolName: string;
    state: string;
    input?: any;
    output?: any;
}

export function CardRouter({ toolName, state, input, output }: CardRouterProps) {
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
                        {typeof output === "string" ? output : (output as any)?.message || "Something went wrong."}
                    </p>
                </CardContent>
            </Card>
        );
    }

    const data = output;
    if (!data) return null;

    switch (toolName) {
        case "getRevenue":
        case "getRevenueBreakdown":
            return <RevenueCard data={data} />;
        case "getOrders":
        case "getOrderDetails":
            return <OrdersCard data={data} />;
        case "getTopProducts":
        case "getProductDetails":
            return <ProductsCard data={data} />;
        case "getInventoryStatus":
            return <InventoryCard data={data} />;
        case "comparePerformance":
            return <ComparisonCard data={data} />;
        case "getCustomerMetrics":
            return <CustomerCard data={data} />;
        case "getInstagramAccountStats":
        case "getTopInstagramPosts":
        case "getInstagramPostPerformance":
        case "getInstagramComments":
            return <InstagramCard data={data} />;
        case "getProductReviews":
        case "getReviewSummary":
            return <ReviewsCard data={data} />;
        default:
            return <GenericMetricCard data={data} toolName={toolName} />;
    }
}
