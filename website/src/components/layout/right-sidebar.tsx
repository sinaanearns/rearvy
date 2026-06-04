"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Info,
  AlertCircle,
  Bell,
} from "lucide-react";
import { useAssistantAlerts } from "./use-assistant-alerts";

/* ─── Notifications ─── */

interface NotificationItem {
  id: string;
  type: "success" | "info" | "warning";
  title: string;
  summary: string;
  timeLabel: string;
  href: string;
  isRead: boolean;
}

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
  const router = useRouter();
  const { alerts, unreadCount, markAlertRead, markAllRead } = useAssistantAlerts();

  const notificationItems = useMemo<NotificationItem[]>(
    () =>
      alerts.map((alert) => ({
        id: alert.id,
        type: alert.severity,
        title: alert.title,
        summary: alert.summary,
        timeLabel: alert.timeLabel,
        href: alert.href,
        isRead: alert.isRead,
      })),
    [alerts]
  );

  return (
    <aside className="hidden overflow-hidden border-l bg-sidebar md:flex md:w-80 md:flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div>
          <h2 className="text-sm font-semibold leading-tight">Notifications</h2>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "All caught up"}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/15 bg-primary/10 text-primary">
          <Bell className="h-4 w-4" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {unreadCount > 0 && (
          <div className="flex justify-end px-4 pt-3 pb-2">
            <button
              onClick={() => void markAllRead()}
              className="rounded-[8px] border border-border/70 bg-background px-2 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-accent/50"
            >
              Mark all read
            </button>
          </div>
        )}

        <div className="py-2 px-3 space-y-2">
          {notificationItems.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-border/70 bg-background/60 px-4 py-14 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] border border-border/70 bg-muted/40 text-muted-foreground">
                <Bell className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                No assistant alerts
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Required updates will appear here.
              </p>
            </div>
          ) : (
            notificationItems.map((notif) => {
              const config = notifConfig[notif.type];
              const Icon = config.icon;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    void markAlertRead(notif.id, true);
                    router.push(notif.href);
                  }}
                  className={cn(
                    "cursor-pointer rounded-[8px] border p-3 shadow-sm shadow-slate-950/[0.03] transition-all hover:border-border/80 hover:bg-accent/40",
                    notif.isRead
                      ? "border-transparent bg-muted/30 opacity-60 hover:opacity-80"
                      : "border-border bg-background shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border/50",
                        config.bg
                      )}
                    >
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-[8px] px-2 py-0.5 text-xs font-medium",
                            config.badgeClass
                          )}
                        >
                          {config.label}
                        </span>
                        {!notif.isRead && (
                          <span className="h-2 w-2 rounded-[8px] bg-primary animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {notif.summary}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <span className="inline-block h-1 w-1 rounded-[8px] bg-muted-foreground/40" />
                        {notif.timeLabel}
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
      {notificationItems.length > 0 && (
        <div className="shrink-0 border-t bg-muted/30 px-4 py-3">
          <p className="text-center text-xs text-muted-foreground">
            Only required alerts appear here
          </p>
        </div>
      )}
    </aside>
  );
}
