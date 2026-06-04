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
import TradingMapCard from "./trading-map-card";
import type { MapVisualizationPayload } from "@/lib/maps/map-types";
import { MediaCard } from "./media-card";
import { DocumentCard } from "./document-card";
import {
    DesktopWorkflowInlineApprovalCard,
    HumanResponseCard,
    ToolApprovalCard,
    isPendingDesktopWorkflowOutput,
} from "@/components/chat/human-response-card";
import { BrowserConnectionCard } from "@/components/chat/browser-connection-card";
import type { BrowserConnectionCardDisplay } from "@/lib/chat/browser-connection-rendering";


import { GmailComposeCard } from "./gmail-compose-card";
import { AlertTriangle, Loader2, Sparkles, Wrench } from "lucide-react";
import { TradingOpinion } from "@/types/trading";
import { DataCardFrame } from "./data-card-frame";

interface CardRouterProps {
    toolName: string;
    state: string;
    toolCallId?: string;
    input?: unknown;
    output?: unknown;
    approval?: unknown;
    chatId?: string;
    browserCardMode?: "full" | "details";
    browserConnectionDisplay?: BrowserConnectionCardDisplay;
    onToolOutput?: (params: {
        tool: string;
        toolCallId: string;
        output: unknown;
    }) => void | PromiseLike<void>;
    onToolApprovalResponse?: (params: {
        id: string;
        approved: boolean;
        reason?: string;
    }) => void | PromiseLike<void>;
}

type RevenueCardData = ComponentProps<typeof RevenueCard>["data"];
type OrdersCardData = ComponentProps<typeof OrdersCard>["data"];
type ProductsCardData = ComponentProps<typeof ProductsCard>["data"];
type InventoryCardData = ComponentProps<typeof InventoryCard>["data"];
type ComparisonCardData = ComponentProps<typeof ComparisonCard>["data"];
type CustomerCardData = ComponentProps<typeof CustomerCard>["data"];
type InstagramCardData = ComponentProps<typeof InstagramCard>["data"];
type ReviewsCardData = ComponentProps<typeof ReviewsCard>["data"];
type MediaCardData = ComponentProps<typeof MediaCard>["data"];

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

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMediaCardData(data: Record<string, unknown>): data is MediaCardData {
    const mode = data.mode;

    return (
        typeof data.ok === "boolean" &&
        (mode === "image" || mode === "image-edit" || mode === "video") &&
        typeof data.prompt === "string" &&
        (data.provider === undefined || typeof data.provider === "string") &&
        (data.aspectRatio === undefined || typeof data.aspectRatio === "string") &&
        (data.images === undefined || isStringArray(data.images)) &&
        (data.videos === undefined || isStringArray(data.videos)) &&
        (data.jobId === undefined || typeof data.jobId === "string") &&
        (data.status === undefined || typeof data.status === "string") &&
        (data.pollingUrl === undefined || typeof data.pollingUrl === "string") &&
        (data.message === undefined || typeof data.message === "string") &&
        (data.presentation === undefined || data.presentation === "design") &&
        (data.originalPrompt === undefined || typeof data.originalPrompt === "string") &&
        (data.designSummary === undefined || typeof data.designSummary === "string")
    );
}

export function CardRouter({
    toolName,
    state,
    toolCallId,
    input,
    output,
    approval,
    chatId,
    browserCardMode,
    browserConnectionDisplay,
    onToolOutput,
    onToolApprovalResponse,
}: CardRouterProps) {
    const isEarlySchemaProviderTool = /tiktok|woo/i.test(toolName);

    if (toolName === "askUser") {
        return (
            <HumanResponseCard
                toolCallId={toolCallId}
                state={state}
                input={input}
                output={output}
                onToolOutput={onToolOutput}
            />
        );
    }

    if (toolName === "requestBrowserConnection") {
        return (
            <BrowserConnectionCard
                toolCallId={toolCallId}
                state={state}
                input={input}
                output={output}
                browserCardMode={browserCardMode}
                display={browserConnectionDisplay}
                onToolOutput={onToolOutput}
            />
        );
    }

    if (state === "approval-requested" || state === "approval-responded") {
        return (
            <ToolApprovalCard
                toolName={toolName}
                state={state}
                input={input}
                approval={approval}
                onToolApprovalResponse={onToolApprovalResponse}
            />
        );
    }

    if (state === "running" || state === "partial") {
        return (
            <DataCardFrame
                icon={Sparkles}
                title="Analyzing request"
                subtitle={toolName.replace(/^get/, "").replace(/([A-Z])/g, " $1").toLowerCase()}
                tone="violet"
            >
                <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Preparing the result card...
                </div>
            </DataCardFrame>
        );
    }

    if (state === "error") {
        return (
            <DataCardFrame
                icon={AlertTriangle}
                title="Tool error"
                subtitle={toolName}
                tone="rose"
            >
                <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                    {typeof output === "string"
                        ? output
                        : typeof output === "object" &&
                            output !== null &&
                            "message" in output &&
                            typeof output.message === "string"
                          ? output.message
                          : "Something went wrong."}
                </div>
            </DataCardFrame>
        );
    }

    const data =
        output && typeof output === "object"
            ? (output as Record<string, unknown>)
            : null;

    if (isPendingDesktopWorkflowOutput(toolName, data)) {
        return <DesktopWorkflowInlineApprovalCard output={data as Record<string, unknown>} />;
    }

    if (!data && output != null) {
        return (
            <DataCardFrame icon={Wrench} title={toolName} tone="cyan">
                <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-foreground/90 dark:border-white/10 dark:bg-white/[0.04]">
                    {String(output)}
                </div>
            </DataCardFrame>
        );
    }

    if (!data) {
        if (isEarlySchemaProviderTool) {
            return (
                <DataCardFrame
                    icon={Wrench}
                    title="Coming soon"
                    subtitle="Integration card rollout"
                    tone="amber"
                >
                    <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                        This integration is connected, but dashboard cards for this channel are still rolling out.
                    </div>
                </DataCardFrame>
            );
        }
        return null;
    }

    if (data.status === "coming_soon" || data.status === "unsupported_schema") {
        return (
            <DataCardFrame
                icon={Wrench}
                title="Coming soon"
                subtitle="Integration view unavailable"
                tone="amber"
            >
                <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                    {typeof data.message === "string"
                        ? data.message
                        : "This integration is connected, but this view is not yet available."}
                </div>
            </DataCardFrame>
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
        case "generateMap":
            return <TradingMapCard data={data as MapVisualizationPayload} />;
        case "generateMedia":
            if (isMediaCardData(data)) {
                return <MediaCard data={data} />;
            }
            return <GenericMetricCard data={data} toolName={toolName} />;
        case "generateDocument":
            return <DocumentCard data={data} />;

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
        case "planWorkflow":
        case "executeWorkflow":
            return null;
        default:
            return <GenericMetricCard data={data} toolName={toolName} />;
    }
}
