"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Info,
  AlertCircle,
  Bell,
} from "lucide-react";

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

export function RightSidebar() {
  const [readNotifs, setReadNotifs] = useState<Set<string>>(new Set());

  const unreadNotifCount = NOTIFICATIONS.filter(
    (n) => !readNotifs.has(n.id)
  ).length;

  const markAllNotifsRead = () => {
    setReadNotifs(new Set(NOTIFICATIONS.map((n) => n.id)));
  };

  const markNotifRead = (id: string) => {
    setReadNotifs((prev) => new Set([...prev, id]));
  };

  return (
    <aside className="hidden md:flex md:w-80 flex-col border-l bg-sidebar overflow-hidden">
      {/* Header */}
      <div className="flex h-14 items-center border-b shrink-0 px-4 justify-between">
        <div>
          <h2 className="text-sm font-semibold leading-tight">Notifications</h2>
          <p className="text-[11px] text-muted-foreground">
            {unreadNotifCount > 0
              ? `${unreadNotifCount} unread`
              : "All caught up"}
          </p>
        </div>
        <Bell className="h-4 w-4 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
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
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-3 shrink-0">
        <p className="text-center text-[10px] text-muted-foreground">
          Stay up to date
        </p>
      </div>
    </aside>
  );
}
