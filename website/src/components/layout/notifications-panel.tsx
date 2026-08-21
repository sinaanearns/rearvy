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
    // Intentionally empty: only required notifications should be shown.
    // Populate this from real backend events instead of sample content.
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
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-[8px] bg-red-500 text-[10px] font-semibold text-white">
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
                    "fixed inset-y-0 right-0 z-50 flex h-screen w-full max-w-sm flex-col border-l bg-background shadow-sm transition-transform duration-300 ease-in-out",
                    open ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10">
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
                                className="h-7 rounded-[8px] px-2 text-xs text-muted-foreground"
                                onClick={markAllRead}
                            >
                                Mark all read
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-[8px]"
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
                            className="mx-4 mt-4 cursor-pointer rounded-[8px] border border-red-200 bg-red-50 p-4 shadow-sm shadow-red-950/[0.03] dark:border-red-900/40 dark:bg-red-950/20"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-red-100 dark:bg-red-900/40">
                                    <Zap className="h-4 w-4 text-red-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                            Action Required
                                        </span>
                                        <span className="hidden">
                                            ⚡ Action Required
                                        </span>
                                        {!isRead && (
                                            <span className="inline-block h-1.5 w-1.5 rounded-[8px] bg-red-500" />
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
                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                    {BUSINESS_NEWS.length === 0 ? (
                        <div className="rounded-[8px] border border-dashed border-border/70 bg-muted/20 px-4 py-16 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] border border-border/70 bg-background text-muted-foreground">
                                <Bell className="h-5 w-5" />
                            </div>
                            <p className="mt-3 text-sm font-medium text-foreground">
                                No required notifications
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Alerts will appear when they need attention.
                            </p>
                        </div>
                    ) : BUSINESS_NEWS.filter((n) => !n.urgent).map((news) => {
                        const config = categoryConfig[news.category];
                        const Icon = config.icon;
                        const isRead = read.has(news.id);

                        return (
                            <div
                                key={news.id}
                                onClick={() => markRead(news.id)}
                                className={cn(
                                    "group cursor-pointer rounded-[8px] border p-4 shadow-sm shadow-slate-950/[0.03] transition-all hover:border-border/80 hover:bg-accent/30",
                                    isRead
                                        ? "border-transparent bg-transparent opacity-70"
                                        : "border-border/50 bg-card"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors",
                                            config.bg
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4", config.color)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center rounded-[8px] px-2 py-0.5 text-xs font-medium",
                                                    config.badgeClass
                                                )}
                                            >
                                                {config.label}
                                            </span>
                                            {!isRead && (
                                                <span className="inline-block h-1.5 w-1.5 rounded-[8px] bg-primary" />
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
                        Only required alerts appear here
                    </p>
                </div>
            </div>
        </>
    );
}
