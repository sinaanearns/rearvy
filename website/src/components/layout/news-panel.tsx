"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Megaphone,
  BarChart2,
  Zap,
} from "lucide-react";

interface NewsItem {
  id: string;
  category: "alert" | "market" | "ecommerce" | "social" | "insight";
  title: string;
  summary: string;
  time: string;
  urgent?: boolean;
}

const BUSINESS_NEWS: NewsItem[] = [
  // Intentionally empty: only required notifications should be shown.
  // Populate this from real backend events instead of static/demo content.
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

export function NewsPanel() {
  const [readNews, setReadNews] = useState<Set<string>>(new Set());

  const unreadNewsCount = BUSINESS_NEWS.filter(
    (n) => !readNews.has(n.id)
  ).length;

  const markNewsRead = (id: string) => {
    setReadNews((prev) => new Set([...prev, id]));
  };

  const markAllNewsRead = () => {
    setReadNews(new Set(BUSINESS_NEWS.map((n) => n.id)));
  };

  return (
    <aside className="hidden md:flex md:w-80 flex-col border-l bg-sidebar overflow-hidden">
      {/* Header */}
      <div className="flex h-14 items-center border-b shrink-0 px-4 gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">News</h2>
          <p className="text-[11px] text-muted-foreground">
            {unreadNewsCount > 0 ? `${unreadNewsCount} unread` : "All caught up"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {unreadNewsCount > 0 && (
          <div className="flex justify-end px-4 pt-3">
            <button
              onClick={markAllNewsRead}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          </div>
        )}

        {/* Urgent news */}
        {BUSINESS_NEWS.filter((n) => n.urgent).map((news) => {
          const isRead = readNews.has(news.id);
          return (
            <div
              key={news.id}
              onClick={() => markNewsRead(news.id)}
              className="mx-3 mt-3 cursor-pointer rounded-xl border-2 border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20"
            >
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                  <Zap className="h-3.5 w-3.5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                      Action Required
                    </span>
                    {!isRead && (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-snug">
                    {news.title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {news.summary}
                  </p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                    {news.time}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Regular news */}
        <div className="py-2 px-3 space-y-1.5">
          {BUSINESS_NEWS.length === 0 ? (
            <div className="py-14 text-center">
              <Zap className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No required news alerts right now
              </p>
            </div>
          ) : (
            BUSINESS_NEWS.filter((n) => !n.urgent).map((news) => {
            const config = categoryConfig[news.category];
            const Icon = config.icon;
            const isRead = readNews.has(news.id);

            return (
              <div
                key={news.id}
                onClick={() => markNewsRead(news.id)}
                className={cn(
                  "cursor-pointer rounded-xl border p-3 transition-all hover:border-border/80 hover:bg-accent/30",
                  isRead
                    ? "border-transparent bg-transparent opacity-70"
                    : "border-border/50 bg-card"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                      config.bg
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                          config.badgeClass
                        )}
                      >
                        {config.label}
                      </span>
                      {!isRead && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground leading-snug">
                      {news.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {news.summary}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/50">
                      {news.time}
                    </p>
                  </div>
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground">
          Curated for your business · Updated daily
        </p>
      </div>
    </aside>
  );
}
