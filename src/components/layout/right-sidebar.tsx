"use client";

import { useState } from "react";
import {
  Newspaper,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Zap,
  BarChart2,
  Megaphone,
  Globe,
  X,
  Bell,
  CheckCircle2,
  Info,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-provider";

/* ─── News ─── */

interface NewsItem {
  id: string;
  category: "alert" | "market" | "ecommerce" | "social" | "insight";
  title: string;
  summary: string;
  time: string;
  urgent?: boolean;
}

const BUSINESS_NEWS: NewsItem[] = [
  {
    id: "1",
    category: "alert",
    urgent: true,
    title: "Google Updates Shopping Ads Policy",
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
      "Amazon announced FBA fulfillment fee hikes of 5-8% starting March 15. Review your pricing and margins for any Amazon-adjacent products to stay profitable.",
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

/* ─── Notifications ─── */

interface NotificationItem {
  id: string;
  type: "success" | "info" | "warning";
  title: string;
  summary: string;
  time: string;
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    type: "success",
    title: "Shopify Sync Completed",
    summary:
      "All 248 products have been synced successfully from your Shopify store.",
    time: "5 min ago",
  },
  {
    id: "n2",
    type: "warning",
    title: "API Quota at 80%",
    summary:
      "Your YouTube Data API quota is at 80%. Consider optimizing sync frequency to avoid hitting limits.",
    time: "1 hr ago",
  },
  {
    id: "n3",
    type: "info",
    title: "New Insight Available",
    summary:
      "A new revenue trend insight has been generated based on your latest sales data.",
    time: "3 hrs ago",
  },
  {
    id: "n4",
    type: "success",
    title: "Project Created",
    summary: 'Your project "Summer Campaign" was created and is ready to use.',
    time: "5 hrs ago",
  },
  {
    id: "n5",
    type: "info",
    title: "Integration Update",
    summary:
      "The Shopify integration has been updated to v2.3 with improved order tracking.",
    time: "Yesterday",
  },
];

const notifConfig = {
  success: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Success",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Info",
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Warning",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
};

/* ─── Component ─── */

type TabId = "news" | "notifications";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "news", label: "News", icon: Newspaper },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export function RightSidebar() {
  const { isRightOpen, toggleRight, rightTab, setRightTab } = useSidebar();
  const activeTab = rightTab;
  const setActiveTab = setRightTab;
  const [readNews, setReadNews] = useState<Set<string>>(new Set());
  const [readNotifs, setReadNotifs] = useState<Set<string>>(new Set());

  const unreadNewsCount = BUSINESS_NEWS.filter(
    (n) => !readNews.has(n.id)
  ).length;
  const unreadNotifCount = NOTIFICATIONS.filter(
    (n) => !readNotifs.has(n.id)
  ).length;
  const collapsed = !isRightOpen;

  function markAllNewsRead() {
    setReadNews(new Set(BUSINESS_NEWS.map((n) => n.id)));
  }

  function markNewsRead(id: string) {
    setReadNews((prev) => new Set([...prev, id]));
  }

  function markAllNotifsRead() {
    setReadNotifs(new Set(NOTIFICATIONS.map((n) => n.id)));
  }

  function markNotifRead(id: string) {
    setReadNotifs((prev) => new Set([...prev, id]));
  }

  function getUnreadCount(tabId: TabId) {
    return tabId === "news" ? unreadNewsCount : unreadNotifCount;
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-30 hidden flex-col border-l bg-sidebar md:flex transition-[width] duration-300 ease-in-out overflow-hidden",
        isRightOpen ? "w-80" : "w-14"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex h-14 items-center border-b shrink-0 transition-all duration-300",
          collapsed ? "justify-center px-1" : "justify-between px-4"
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {tabs.filter((tab) => tab.id !== "notifications").map((tab) => {
              const Icon = tab.icon;
              const count = getUnreadCount(tab.id);
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setActiveTab(tab.id);
                        toggleRight();
                      }}
                      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      {count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8}>
                    {tab.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight whitespace-nowrap">
                  {tabs.find((t) => t.id === activeTab)?.label ?? "News"}
                </h2>
                <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {getUnreadCount(activeTab) > 0
                    ? `${getUnreadCount(activeTab)} unread`
                    : "All caught up"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleRight}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Tab switcher */}
      {!collapsed && (
        <div className="flex border-b px-3 py-1.5 gap-1 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const count = getUnreadCount(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Content area */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* ─── News Tab ─── */}
          {activeTab === "news" && (
            <>
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
                {BUSINESS_NEWS.filter((n) => !n.urgent).map((news) => {
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
                })}
              </div>
            </>
          )}

          {/* ─── Notifications Tab ─── */}
          {activeTab === "notifications" && (
            <>
              {unreadNotifCount > 0 && (
                <div className="flex justify-end px-4 pt-3">
                  <button
                    onClick={markAllNotifsRead}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mark all read
                  </button>
                </div>
              )}

              <div className="py-2 px-3 space-y-1.5">
                {NOTIFICATIONS.map((notif) => {
                  const config = notifConfig[notif.type];
                  const Icon = config.icon;
                  const isRead = readNotifs.has(notif.id);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => markNotifRead(notif.id)}
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
                            {notif.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                            {notif.summary}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground/50">
                            {notif.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="border-t px-4 py-3 shrink-0">
          <p className="text-center text-[10px] text-muted-foreground">
            Curated for your business · Updated daily
          </p>
        </div>
      )}
    </aside>
  );
}
