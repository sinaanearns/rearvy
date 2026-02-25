"use client";

import { useState } from "react";
import { Bell, X, TrendingUp, ShoppingCart, Globe, AlertTriangle, Zap, BarChart2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NewsItem {
    id: string;
    category: "alert" | "market" | "ecommerce" | "social" | "insight";
    title: string;
    summary: string;
    time: string;
    urgent?: boolean;
    link?: string;
}

const BUSINESS_NEWS: NewsItem[] = [
    {
        id: "1",
        category: "alert",
        urgent: true,
        title: "🚨 Google Updates Shopping Ads Policy",
        summary:
            "Google has updated its Shopping Ads pricing policy effective March 2026. Any discrepancies between landing page and ad prices may lead to disapproval of your product listings.",
        time: "Just now",
    },
    {
        id: "2",
        category: "ecommerce",
        title: "Shopify Checkout Extensibility Now GA",
        summary:
            "Shopify's new Checkout Extensibility is now generally available for all plans. Merchants can add custom UI components without checkout.liquid, improving conversion rates.",
        time: "2 hrs ago",
    },
    {
        id: "3",
        category: "market",
        title: "Meta Ads CPM Rising Ahead of Q2",
        summary:
            "Meta ad costs are trending up 18% YoY as Q2 competition heats up. Consider locking in campaigns early and diversifying to TikTok Ads or Pinterest for better ROI.",
        time: "4 hrs ago",
    },
    {
        id: "4",
        category: "social",
        title: "TikTok Shop Expanding to New Markets",
        summary:
            "TikTok Shop is rolling out to India and the Middle East. If your business targets these regions, this is a major new channel opportunity — early movers get algorithm priority.",
        time: "6 hrs ago",
    },
    {
        id: "5",
        category: "insight",
        title: "Email Open Rates Hit 5-Year High",
        summary:
            "Industry data shows email open rates at a 5-year high (42.3% avg), driven by iOS 18 privacy changes. Re-invest in your email list and segment campaigns for max impact.",
        time: "8 hrs ago",
    },
    {
        id: "6",
        category: "ecommerce",
        title: "Amazon FBA Fee Increases in March",
        summary:
            "Amazon announced FBA fulfillment fee hikes of 5–8% starting March 15. Review your pricing and margins for any Amazon-adjacent products to stay profitable.",
        time: "Yesterday",
    },
    {
        id: "7",
        category: "market",
        title: "Consumer Confidence Index Up 3.2 Points",
        summary:
            "The Consumer Confidence Index rose to 104.7, indicating stronger purchase intent. Great time to push promotions, launch new products, or run loyalty campaigns.",
        time: "Yesterday",
    },
];

const categoryConfig = {
    alert: {
        icon: AlertTriangle,
        color: "text-red-500",
        bg: "bg-red-500/10",
        label: "Alert",
        badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    },
    market: {
        icon: TrendingUp,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        label: "Market",
        badgeClass:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    },
    ecommerce: {
        icon: ShoppingCart,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        label: "E-Commerce",
        badgeClass:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    social: {
        icon: Megaphone,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
        label: "Social",
        badgeClass:
            "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
    },
    insight: {
        icon: BarChart2,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        label: "Insight",
        badgeClass:
            "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    },
};

export function NotificationsPanel() {
    const [open, setOpen] = useState(false);
    const [read, setRead] = useState<Set<string>>(new Set());

    const unreadCount = BUSINESS_NEWS.filter((n) => !read.has(n.id)).length;

    function markAllRead() {
        setRead(new Set(BUSINESS_NEWS.map((n) => n.id)));
    }

    function markRead(id: string) {
        setRead((prev) => new Set([...prev, id]));
    }

    return (
        <>
            {/* Trigger button */}
            <div className="relative">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(true)}
                    title="Business news & notifications"
                    className="relative"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </div>

            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 z-40 h-screen w-screen bg-black/20 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Slide-in panel */}
            <div
                className={cn(
                    "fixed inset-y-0 right-0 z-50 flex h-screen w-full max-w-sm flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-in-out",
                    open ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold leading-tight">Business News</h2>
                            <p className="text-xs text-muted-foreground">
                                {unreadCount > 0 ? `${unreadCount} unread updates` : "All caught up!"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 px-2 text-muted-foreground"
                                onClick={markAllRead}
                            >
                                Mark all read
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Urgent top news */}
                {BUSINESS_NEWS.filter((n) => n.urgent).map((news) => {
                    const isRead = read.has(news.id);
                    return (
                        <div
                            key={news.id}
                            onClick={() => markRead(news.id)}
                            className="mx-4 mt-4 cursor-pointer rounded-xl border-2 border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                                    <Zap className="h-4 w-4 text-red-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                                            ⚡ Action Required
                                        </span>
                                        {!isRead && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-foreground leading-snug">
                                        {news.title}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                        {news.summary}
                                    </p>
                                    <p className="mt-2 text-[10px] text-muted-foreground/60">{news.time}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* News list */}
                <div className="flex-1 overflow-y-auto py-3 px-4 space-y-2">
                    {BUSINESS_NEWS.filter((n) => !n.urgent).map((news) => {
                        const config = categoryConfig[news.category];
                        const Icon = config.icon;
                        const isRead = read.has(news.id);

                        return (
                            <div
                                key={news.id}
                                onClick={() => markRead(news.id)}
                                className={cn(
                                    "group cursor-pointer rounded-xl border p-4 transition-all hover:border-border/80 hover:bg-accent/30",
                                    isRead
                                        ? "border-transparent bg-transparent opacity-70"
                                        : "border-border/50 bg-card"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                                            config.bg
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4", config.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                                    config.badgeClass
                                                )}
                                            >
                                                {config.label}
                                            </span>
                                            {!isRead && (
                                                <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-foreground leading-snug">
                                            {news.title}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                            {news.summary}
                                        </p>
                                        <p className="mt-2 text-[10px] text-muted-foreground/50">
                                            {news.time}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="border-t px-5 py-4 shrink-0">
                    <p className="text-center text-[11px] text-muted-foreground">
                        News curated for your business profile · Updated daily
                    </p>
                </div>
            </div>
        </>
    );
}
