"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  PanelLeft,
  PanelRight,
  Bell,
  Info,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Sidebar } from "./sidebar";
import { useSidebar } from "./sidebar-provider";
import { cn } from "@/lib/utils";

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


interface RecentChat {
  id: string;
  title: string | null;
  updated_at: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface TopbarProps {
  userName?: string | null;
  userEmail?: string | null;
  recentChats?: RecentChat[];
  projects?: Project[];
}

export function Topbar({
  userName,
  userEmail,
  recentChats = [],
  projects = [],
}: TopbarProps) {
  const { toggle, togglePanels } = useSidebar();
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              suppressHydrationWarning
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <Sidebar
              variant="mobile"
              userName={userName}
              userEmail={userEmail}
              recentChats={recentChats}
              projects={projects}
            />
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar Toggle (Left Spot) */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          title="Toggle Sidebar"
          onClick={toggle}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>

        <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
          <Link href="/chat/new">
            <Plus className="h-4 w-4" />
            New Chat
          </Link>
        </Button>

        <span className="text-lg font-semibold md:hidden">Rearvy</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Notifications"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0">
            <div className="flex flex-col max-h-[500px]">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3 bg-background">
                <div>
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  <p className="text-xs text-muted-foreground">
                    {unreadNotifCount > 0
                      ? `${unreadNotifCount} unread`
                      : "All caught up"}
                  </p>
                </div>
                {unreadNotifCount > 0 && (
                  <button
                    onClick={markAllNotifsRead}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto p-2 space-y-1.5">
                {NOTIFICATIONS.length === 0 ? (
                  <div className="py-12 text-center">
                    <Bell className="mx-auto h-12 w-12 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">
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
                          "relative cursor-pointer rounded-lg border p-3 transition-all hover:bg-accent/50",
                          isRead
                            ? "border-transparent bg-muted/30 opacity-60 hover:opacity-80"
                            : "border-border bg-background shadow-sm"
                        )}
                      >
                        <div className="flex items-start gap-3">
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

              {/* Footer */}
              {NOTIFICATIONS.length > 0 && (
                <div className="border-t px-4 py-2.5 bg-muted/30">
                  <p className="text-center text-xs text-muted-foreground">
                    Stay up to date with your business
                  </p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Toggle Right Panels Button */}
        <Button
          variant="ghost"
          size="icon"
          title="Toggle Right Panels"
          onClick={togglePanels}
          className="hidden md:flex"
        >
          <PanelRight className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
