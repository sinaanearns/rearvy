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
import TradingOpinionCard from "./trading-opinion-card";

import { GmailComposeCard } from "./gmail-compose-card";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TradingOpinion } from "@/types/trading";

interface CardRouterProps {
    toolName: string;
    state: string;
    output?: unknown;
    chatId?: string;
    browserCardMode?: "full" | "details";
}

type RevenueCardData = ComponentProps<typeof RevenueCard>["data"];
type OrdersCardData = ComponentProps<typeof OrdersCard>["data"];
type ProductsCardData = ComponentProps<typeof ProductsCard>["data"];
type InventoryCardData = ComponentProps<typeof InventoryCard>["data"];
type ComparisonCardData = ComponentProps<typeof ComparisonCard>["data"];
type CustomerCardData = ComponentProps<typeof CustomerCard>["data"];
type InstagramCardData = ComponentProps<typeof InstagramCard>["data"];
type ReviewsCardData = ComponentProps<typeof ReviewsCard>["data"];

const TRADING_ACTIONS: TradingOpinion["action"][] = ["Buy", "Sell", "Hold"];
const TRADING_TIMEFRAMES: TradingOpinion["timeframe"][] = ["M15", "M30", "H1", "H4", "D1", "W1"];

function isTradingOpinionRecord(data: unknown): data is TradingOpinion {
    if (!data || typeof data !== "object") {
        return false;
    }

    const record = data as Record<string, unknown>;
    return (
        typeof record.action === "string" &&
        TRADING_ACTIONS.includes(record.action as TradingOpinion["action"]) &&
        typeof record.confidence === "number" &&
        typeof record.reason === "string" &&
        typeof record.symbol === "string" &&
        typeof record.timeframe === "string" &&
        TRADING_TIMEFRAMES.includes(record.timeframe as TradingOpinion["timeframe"]) &&
        typeof record.riskNotes === "string" &&
        typeof record.fetchedAt === "number"
    );
}

type BestTradeToolOutput = {
    action?: TradingOpinion["action"];
    confidence?: number;
    reason?: string;
    evaluatedAt?: number;
    bestTrade?: {
        symbol?: string;
        timeframe?: TradingOpinion["timeframe"];
        action?: TradingOpinion["action"];
        confidence?: number;
        entry?: number;
        stopLoss?: number;
        takeProfit?: number;
        reasoning?: string;
        riskNotes?: string;
        fetchedAt?: number;
    } | null;
    rankedCandidates?: Array<{
        symbol?: string;
        timeframe?: TradingOpinion["timeframe"];
    }>;
};

function normalizeBestTradeToOpinion(output: unknown): TradingOpinion | null {
    if (!output || typeof output !== "object") {
        return null;
    }

    const parsed = output as BestTradeToolOutput;
    const fromBest = parsed.bestTrade && typeof parsed.bestTrade === "object" ? parsed.bestTrade : null;

    if (fromBest?.symbol && fromBest?.timeframe && fromBest?.action) {
        return {
            action: fromBest.action,
            confidence: typeof fromBest.confidence === "number" ? fromBest.confidence : 0,
            reason:
                typeof fromBest.reasoning === "string" && fromBest.reasoning.trim().length > 0
                    ? fromBest.reasoning
                    : typeof parsed.reason === "string"
                        ? parsed.reason
                        : "Trade setup generated.",
            symbol: fromBest.symbol,
            timeframe: fromBest.timeframe,
            entry: fromBest.entry,
            stopLoss: fromBest.stopLoss,
            takeProfit: fromBest.takeProfit,
            riskNotes:
                typeof fromBest.riskNotes === "string" && fromBest.riskNotes.trim().length > 0
                    ? fromBest.riskNotes
                    : "Use disciplined risk management and wait for confirmation.",
            fetchedAt: typeof fromBest.fetchedAt === "number" ? fromBest.fetchedAt : Date.now(),
        };
    }

    if (parsed.action === "Hold") {
        const firstRanked = Array.isArray(parsed.rankedCandidates)
            ? parsed.rankedCandidates.find(
                  (entry) =>
                      typeof entry?.symbol === "string" &&
                      typeof entry?.timeframe === "string"
              )
            : undefined;

        return {
            action: "Hold",
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
            reason:
                typeof parsed.reason === "string" && parsed.reason.trim().length > 0
                    ? parsed.reason
                    : "No valid trade found across evaluated candidates.",
            symbol: firstRanked?.symbol ?? "Market Basket",
            timeframe: firstRanked?.timeframe ?? "H1",
            riskNotes: "No recommendation issued. Wait for stronger directional evidence.",
            fetchedAt: typeof parsed.evaluatedAt === "number" ? parsed.evaluatedAt : Date.now(),
        };
    }

    return null;
}

export function CardRouter({
    toolName,
    state,
    output,
    chatId,
}: CardRouterProps) {
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

    if (!data && output != null) {
        return (
            <Card className="w-full max-w-md border-dashed">
                <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {toolName}
                    </p>
                    <p className="mt-2 text-sm text-foreground/90">
                        {String(output)}
                    </p>
                </CardContent>
            </Card>
        );
    }

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

        case "prepareGmailMessage":
            return <GmailComposeCard data={data} />;
        case "tradingOpinion":
        case "getTradingOpinion":
            if (isTradingOpinionRecord(data)) {
                return <TradingOpinionCard opinion={data} chatId={chatId} />;
            }
            return <GenericMetricCard data={data} toolName={toolName} />;
        case "getBestTradeOpportunity": {
            const normalized = normalizeBestTradeToOpinion(data);
            if (normalized) {
                return <TradingOpinionCard opinion={normalized} chatId={chatId} />;
            }
            return <GenericMetricCard data={data} toolName={toolName} />;
        }
        default:
            return <GenericMetricCard data={data} toolName={toolName} />;
    }
}
