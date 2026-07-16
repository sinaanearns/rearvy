"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isElectron } from "@/lib/utils/env";
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
  LogOut,
  Download,
  RefreshCcw,
  FolderOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sidebar } from "./sidebar";
import { useSidebar } from "./sidebar-provider";
import { InviteModal } from "../chat/invite-modal";
import { ProjectInviteModal } from "../chat/project-invite-modal";
import { WorkspaceExplorer } from "@/components/workspace/workspace-explorer";
import { UpdateChecker } from "./update-checker";
import { cn } from "@/lib/utils";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { signOut } from "@/lib/firebase/auth";
import { toast } from "sonner";
import { useAssistantAlerts } from "./use-assistant-alerts";

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
  const pathname = usePathname();
  const router = useRouter();
  const [desktopUpdateState, setDesktopUpdateState] = useState<{
    supported: boolean;
    checking: boolean;
    updateAvailable: boolean;
    downloading: boolean;
    downloaded: boolean;
    currentVersion: string | null;
    latestVersion: string | null;
    downloadPercent: number | null;
    lastError: string | null;
  } | null>(null);
  const { alerts, unreadCount, markAlertRead, markAllRead } = useAssistantAlerts();

  // Extract chatId from pathname if we are on a chat page
  const chatMatch = pathname?.match(/\/chat\/([a-zA-Z0-9_-]+)/);
  const isNewChat = pathname?.includes('/chat/new');
  const activeChatId = chatMatch && !isNewChat ? chatMatch[1] : null;
  const isChatRoute = pathname?.includes("/chat/") || pathname === "/chat";

  function openFreshNewChat() {
    router.push(`/chat/new?fresh=${Date.now()}`);
  }

  // Extract projectId from pathname if we are on a project page
  const projectMatch = pathname?.match(/\/projects\/([a-zA-Z0-9_-]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;

  const displayName =
    normalizeRearvyDisplayText(userName) ??
    normalizeRearvyDisplayText(userEmail?.split("@")[0]) ??
    "Profile";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  async function handleSignOut() {
    await signOut();
    router.push(isElectron() ? "/login" : "/");
  }

  useEffect(() => {
    if (!isElectron() || !window.electron?.updater) {
      return;
    }

    let mounted = true;
    void window.electron.updater.getState().then((state) => {
      if (mounted) {
        setDesktopUpdateState(state);
      }
    });

    const removeListener = window.electron.updater.onStateChange((state) => {
      if (mounted) {
        setDesktopUpdateState(state);
      }
    });

    return () => {
      mounted = false;
      removeListener?.();
    };
  }, []);

  async function handleCheckForUpdates() {
    if (!window.electron?.updater) {
      return;
    }

    const result = await window.electron.updater.checkForUpdates();
    if (!result.ok) {
      toast.error(result.reason || "Update check failed");
      return;
    }

    toast.success("Checking for updates...");
  }

  async function handleDownloadUpdate() {
    if (!window.electron?.updater) {
      return;
    }

    const result = await window.electron.updater.downloadUpdate();
    if (!result.ok) {
      toast.error(result.reason || "Could not download update");
      return;
    }

    toast.success("Downloading update...");
  }

  async function handleInstallUpdate() {
    if (!window.electron?.updater) {
      return;
    }

    const result = await window.electron.updater.installAndRestart();
    if (!result.ok) {
      toast.error(result.reason || "Update is not ready to install");
    }
  }

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
    <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center justify-between gap-2 border-b bg-background/95 px-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
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

        <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={openFreshNewChat}>
          <Plus className="h-4 w-4" />
          New Chat
        </Button>

        <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={openFreshNewChat} aria-label="New Chat">
          <Plus className="h-5 w-5" />
        </Button>
        
        {activeChatId && (
          <div className="ml-1 shrink-0 sm:ml-2">
            <InviteModal chatId={activeChatId} />
          </div>
        )}

        {activeProjectId && (
          <div className="ml-1 shrink-0 sm:ml-2">
            <ProjectInviteModal projectId={activeProjectId} />
          </div>
        )}

      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {isChatRoute && (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Workspace"
                className="md:hidden"
              >
                <FolderOpen className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm p-0">
              <WorkspaceExplorer variant="panel" />
            </SheetContent>
          </Sheet>
        )}

        {/* Update Checker - Desktop Only */}
        <div className="hidden sm:block">
          <UpdateChecker />
        </div>

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
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-[8px] border border-background bg-red-500 text-[10px] font-semibold text-white shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] overflow-hidden rounded-[8px] border-border/70 p-0 shadow-sm">
            <div className="flex flex-col max-h-[500px]">
              {/* Header */}
              <div className="flex items-center justify-between border-b bg-background px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} unread`
                      : "All caught up"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => void markAllRead()}
                    className="rounded-[8px] border border-border/70 bg-background px-2 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-accent/50"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto p-2 space-y-1.5">
                {notificationItems.length === 0 ? (
                  <div className="rounded-[8px] border border-dashed border-border/70 bg-muted/20 px-4 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] border border-border/70 bg-background text-muted-foreground">
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
                          "relative cursor-pointer rounded-[8px] border p-3 shadow-sm shadow-slate-950/[0.03] transition-all hover:border-border/80 hover:bg-accent/40",
                          notif.isRead
                            ? "border-transparent bg-muted/30 opacity-60 hover:opacity-80"
                            : "border-border bg-background shadow-sm"
                        )}
                      >
                        <div className="flex items-start gap-3">
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

              {/* Footer */}
              {notificationItems.length > 0 && (
                <div className="border-t bg-muted/30 px-4 py-2.5">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Profile" className="rounded-full">
              <Avatar size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-medium">{displayName}</p>
              {userEmail && (
                <p className="truncate text-xs font-normal text-muted-foreground">{userEmail}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">View profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Edit profile</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleSignOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
            {isElectron() && desktopUpdateState?.supported && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  Version {desktopUpdateState.currentVersion || "unknown"}
                  {desktopUpdateState.latestVersion
                    ? ` -> ${desktopUpdateState.latestVersion}`
                    : ""}
                </DropdownMenuItem>
                {desktopUpdateState.downloaded ? (
                  <DropdownMenuItem onClick={() => void handleInstallUpdate()}>
                    <Download className="mr-2 h-4 w-4" />
                    Install update and restart
                  </DropdownMenuItem>
                ) : desktopUpdateState.downloading ? (
                  <DropdownMenuItem disabled>
                    Downloading update
                    {typeof desktopUpdateState.downloadPercent === "number"
                      ? ` (${Math.round(desktopUpdateState.downloadPercent)}%)`
                      : "..."}
                  </DropdownMenuItem>
                ) : desktopUpdateState.updateAvailable ? (
                  <DropdownMenuItem onClick={() => void handleDownloadUpdate()}>
                    <Download className="mr-2 h-4 w-4" />
                    Download update
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={desktopUpdateState.checking}
                    onClick={() => void handleCheckForUpdates()}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {desktopUpdateState.checking
                      ? "Checking for updates..."
                      : "Check for updates"}
                  </DropdownMenuItem>
                )}
                {desktopUpdateState.lastError && (
                  <DropdownMenuItem disabled>
                    Update error: {desktopUpdateState.lastError}
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
