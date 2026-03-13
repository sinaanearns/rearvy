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
  // Intentionally empty: only required notifications should be shown.
  // Populate this from real backend events instead of static/demo content.
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
      <div className="flex h-14 items-center border-b shrink-0 px-4 justify-between bg-background">
        <div>
          <h2 className="text-sm font-semibold leading-tight">Notifications</h2>
          <p className="text-xs text-muted-foreground">
            {unreadNotifCount > 0
              ? `${unreadNotifCount} unread`
              : "All caught up"}
          </p>
        </div>
        <Bell className="h-4 w-4 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {unreadNotifCount > 0 && (
          <div className="flex justify-end px-4 pt-3 pb-2">
            <button
              onClick={markAllNotifsRead}
              className="text-xs text-primary hover:underline font-medium"
            >
              Mark all read
            </button>
          </div>
        )}

        <div className="py-2 px-3 space-y-2">
          {NOTIFICATIONS.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                No notifications yet
              </p>
            </div>
          ) : (
            NOTIFICATIONS.map((notif) => {
              const config = notifConfig[notif.type];
              const Icon = config.icon;
              const isRead = readNotifs.has(notif.id);

              return (
                <div
                  key={notif.id}
                  onClick={() => markNotifRead(notif.id)}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 transition-all hover:bg-accent/50",
                    isRead
                      ? "border-transparent bg-muted/30 opacity-60 hover:opacity-80"
                      : "border-border bg-background shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
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
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            config.badgeClass
                          )}
                        >
                          {config.label}
                        </span>
                        {!isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {notif.summary}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />
                        {notif.time}
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
      {NOTIFICATIONS.length > 0 && (
        <div className="border-t px-4 py-3 shrink-0 bg-muted/30">
          <p className="text-center text-xs text-muted-foreground">
            Only required alerts appear here
          </p>
        </div>
      )}
    </aside>
  );
}
