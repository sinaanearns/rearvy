"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isElectron } from "@/lib/utils/env";
import {
  CheckSquare,
  Plus,
  LogOut,
  Square,
  Folder,
  MoreHorizontal,
  Trash2,
  X,
  LineChart,
  Activity,
  LayoutDashboard,
  MousePointer2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { signOut } from "@/lib/firebase/auth";
import { SidebarFeedback } from "@/components/layout/sidebar-feedback";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import {
  SidebarChatItem,
  type SidebarChatProject,
  type SidebarChatRecord,
} from "@/components/layout/sidebar-chat-item";
import { useSidebar } from "./sidebar-provider";
import { useAuth } from "@/components/auth-provider";

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  recentChats?: SidebarChatRecord[];
  projects?: SidebarChatProject[];
  variant?: "desktop" | "mobile";
}

interface SidebarNavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  collapsed: boolean;
}

const navItems: Array<{ href: string; label: string; icon: React.ElementType }> = [
  { href: "/command", label: "Command", icon: LayoutDashboard },
  { href: "/work", label: "Work", icon: Activity },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/terminal", label: "Operations", icon: Activity },
  { href: "/clicky", label: "Clicky", icon: MousePointer2 },
];

function getTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  return new Date(value).getTime();
}

function sortChats(chats: SidebarChatRecord[]) {
  return [...chats].sort((left, right) => {
    const pinDelta = Number(Boolean(right.is_pinned)) - Number(Boolean(left.is_pinned));
    if (pinDelta !== 0) {
      return pinDelta;
    }

    return getTimestamp(right.updated_at) - getTimestamp(left.updated_at);
  });
}

function sortProjects(projects: SidebarChatProject[]) {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name));
}

function isOwnedChat(chat: SidebarChatRecord, userId: string | null | undefined) {
  if (typeof chat.is_owner === "boolean") {
    return chat.is_owner;
  }

  return Boolean(userId && chat.user_id === userId);
}

function SidebarNavLink({
  href,
  icon: Icon,
  label,
  isActive,
  collapsed,
}: SidebarNavLinkProps) {
  const link = (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center rounded-lg py-2 text-sm transition-colors",
          collapsed ? "justify-center px-2" : "gap-3 px-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </div>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function Sidebar({
  userName,
  userEmail,
  recentChats: recentChatsProp = [],
  projects: projectsProp = [],
  variant = "desktop",
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen } = useSidebar();
  const { user } = useAuth();
  const [showAllChats, setShowAllChats] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isDeleteSelectedOpen, setIsDeleteSelectedOpen] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [recentChats, setRecentChats] = useState<SidebarChatRecord[]>(() =>
    sortChats(recentChatsProp)
  );
  const [projects, setProjects] = useState<SidebarChatProject[]>(() =>
    sortProjects(projectsProp)
  );

  function openFreshNewChat() {
    router.push(`/chat/new?fresh=${Date.now()}`);
  }

  const displayName = userName ?? user?.displayName ?? "User";
  const displayEmail = userEmail ?? user?.email ?? null;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  useEffect(() => {
    setRecentChats(sortChats(recentChatsProp));
  }, [recentChatsProp]);

  useEffect(() => {
    setProjects(sortProjects(projectsProp));
  }, [projectsProp]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch projects
        const projectsRes = await fetch("/api/dashboard/projects", { headers });
        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects(sortProjects(data.projects || []));
        }

        // Fetch recent chats
        const chatsRes = await fetch("/api/dashboard/chats", { headers });
        if (chatsRes.ok) {
          const data = await chatsRes.json();
          setRecentChats(sortChats(data.chats || []));
        }

        const profileRes = await fetch("/api/dashboard/profile", { headers });
        if (profileRes.ok) {
          await profileRes.json();
        }
      } catch (error) {
        console.error("Error loading sidebar data:", error);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, pathname]);

  const collapsed = variant === "desktop" && !isOpen;

  async function handleSignOut() {
    await signOut();
    // Use window.location.href for a full page refresh
    // In Electron, we go to /login to avoid the landing page
    window.location.href = isElectron() ? "/login" : "/";
  }

  function handleChatUpdated(updatedChat: SidebarChatRecord) {
    setRecentChats((currentChats) => {
      const nextChats = currentChats.map((chat) =>
        chat.id === updatedChat.id ? { ...chat, ...updatedChat } : chat
      );
      return sortChats(nextChats);
    });
  }

  function handleChatRemoved(chatId: string) {
    setRecentChats((currentChats) => currentChats.filter((chat) => chat.id !== chatId));
    setSelectedChatIds((currentIds) => currentIds.filter((currentId) => currentId !== chatId));
  }

  function handleProjectCreated(project: SidebarChatProject) {
    setProjects((currentProjects) => {
      if (currentProjects.some((currentProject) => currentProject.id === project.id)) {
        return currentProjects;
      }

      return sortProjects([project, ...currentProjects]);
    });
  }

  function toggleSelectionMode() {
    setSelectionMode((currentValue) => {
      if (currentValue) {
        setSelectedChatIds([]);
      }

      return !currentValue;
    });
  }

  function handleSelectToggle(chatId: string) {
    setSelectedChatIds((currentIds) =>
      currentIds.includes(chatId)
        ? currentIds.filter((currentId) => currentId !== chatId)
        : [...currentIds, chatId]
    );
  }

  function handleSelectAllVisible() {
    const visibleOwnerChatIds = (showAllChats ? recentChats : recentChats.slice(0, 5))
      .filter((chat) => isOwnedChat(chat, user?.uid))
      .map((chat) => chat.id);

    if (visibleOwnerChatIds.length === 0) {
      return;
    }

    const allVisibleSelected = visibleOwnerChatIds.every((chatId) => selectedChatIds.includes(chatId));
    setSelectedChatIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter((chatId) => !visibleOwnerChatIds.includes(chatId));
      }

      return Array.from(new Set([...currentIds, ...visibleOwnerChatIds]));
    });
  }

  async function handleDeleteSelectedChats() {
    if (!user || selectedChatIds.length === 0) {
      return;
    }

    setIsDeletingSelected(true);
    try {
      const token = await user.getIdToken();
      const deletionResults = await Promise.allSettled(
        selectedChatIds.map(async (chatId) => {
          const response = await fetch(`/api/dashboard/chats/${chatId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Failed to delete chat ${chatId}`);
          }

          return chatId;
        })
      );

      const deletedIds = deletionResults
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map((result) => result.value);
      const failedCount = deletionResults.length - deletedIds.length;

      if (deletedIds.length > 0) {
        setRecentChats((currentChats) => currentChats.filter((chat) => !deletedIds.includes(chat.id)));
        setSelectedChatIds((currentIds) => currentIds.filter((chatId) => !deletedIds.includes(chatId)));
        if (deletedIds.includes(pathname.replace("/chat/", ""))) {
            openFreshNewChat();
        }
      }

      setIsDeleteSelectedOpen(false);
      if (deletedIds.length > 0 && failedCount === 0) {
        toast.success(deletedIds.length === 1 ? "Chat deleted." : `${deletedIds.length} chats deleted.`);
      } else if (deletedIds.length > 0) {
        toast.error(`${failedCount} chats could not be deleted.`);
      }

      if (selectedChatIds.length === deletedIds.length) {
        setSelectionMode(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected chats");
    } finally {
      setIsDeletingSelected(false);
    }
  }

  const visibleChats = showAllChats ? recentChats : recentChats.slice(0, 5);
  const visibleOwnerChats = visibleChats.filter((chat) => isOwnedChat(chat, user?.uid));
  const allVisibleSelected =
    visibleOwnerChats.length > 0 && visibleOwnerChats.every((chat) => selectedChatIds.includes(chat.id));
  const isChatRoute = pathname?.split("/").includes("chat") ?? false;

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar overflow-hidden",
        variant === "desktop" &&
          "fixed inset-y-0 left-0 z-30 hidden md:flex transition-[width] duration-300 ease-in-out",
        variant === "desktop" && (isOpen ? "w-60" : "w-16"),
        variant === "mobile" && "w-full h-full"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center border-b shrink-0 transition-all duration-300",
          collapsed ? "justify-center px-2" : "gap-2 px-4"
        )}
      >
        {isChatRoute ? (
          <RearvyLogo
            markOnly
            variant="dark"
            priority
            markSize={36}
            markClassName="h-9 w-9 rounded-none object-contain"
          />
        ) : collapsed ? (
          <RearvyLogo
            markOnly
            priority
            markSize={32}
            markClassName="h-8 w-8"
          />
        ) : (
          <RearvyLogo
            priority
            markSize={36}
            markClassName="h-9 w-9"
            textClassName="text-xl"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {navItems.length > 0 && (
          <>
            {/* Main Menu */}
            <div className={cn("py-4", collapsed ? "px-1.5" : "px-2")}>
              {!collapsed && (
                <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50">
                  Menu
                </p>
              )}
              <div className="space-y-0.5">
                {navItems.map((item) => (
                  <SidebarNavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    isActive={
                      item.href === "/work"
                        ? pathname.startsWith("/work")
                        : pathname.startsWith(item.href)
                    }
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>

            {collapsed && <Separator className="mx-auto w-8" />}
          </>
        )}

        {/* Projects Section */}
        <div className={cn("py-2", collapsed ? "px-1.5" : "px-2")}>
          {!collapsed && (
            <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50">
              Projects
            </p>
          )}
          <div className="space-y-0.5">
            <SidebarNavLink
              href="/projects/new"
              icon={Plus}
              label="New project"
              isActive={false}
              collapsed={collapsed}
            />
            {projects.slice(0, 5).map((project) => (
              <SidebarNavLink
                key={project.id}
                href={`/projects/${project.id}`}
                icon={Folder}
                label={project.name}
                isActive={pathname.startsWith(`/projects/${project.id}`)}
                collapsed={collapsed}
              />
            ))}
            {projects.length > 5 && (
              <SidebarNavLink
                href="/projects"
                icon={MoreHorizontal}
                label="See more"
                isActive={false}
                collapsed={collapsed}
              />
            )}
          </div>
        </div>

        {/* Your chats Section — hidden when collapsed */}
        {!collapsed && recentChats.length > 0 && (
          <div className="px-2 py-2">
            <div className="mb-2 flex items-center justify-between gap-2 px-2">
              <p className="text-xs font-medium text-sidebar-foreground/50">
                {selectionMode ? `${selectedChatIds.length} selected` : "Your chats"}
              </p>
              <div className="flex items-center gap-1">
                {selectionMode ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-6 px-2 text-[11px]"
                      onClick={handleSelectAllVisible}
                      disabled={visibleOwnerChats.length === 0}
                    >
                      {allVisibleSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setIsDeleteSelectedOpen(true)}
                      disabled={selectedChatIds.length === 0}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-6 px-2 text-[11px]"
                      onClick={toggleSelectionMode}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-6 px-2 text-[11px]"
                    onClick={toggleSelectionMode}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Select
                  </Button>
                )}
              </div>
            </div>
            <div
              className={cn(
                "space-y-0.5",
                showAllChats && "max-h-48 overflow-y-auto"
              )}
            >
              {visibleChats.map(
                (chat) => (
                  <SidebarChatItem
                    key={chat.id}
                    chat={chat}
                    pathname={pathname}
                    projects={projects}
                    currentUserId={user?.uid ?? null}
                    selectionMode={selectionMode}
                    isSelected={selectedChatIds.includes(chat.id)}
                    onSelectToggle={handleSelectToggle}
                    onChatUpdated={handleChatUpdated}
                    onChatRemoved={handleChatRemoved}
                    onProjectCreated={handleProjectCreated}
                  />
                )
              )}
            </div>
            {recentChats.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllChats((prev) => !prev)}
                className="mt-2 w-full rounded-lg px-2 py-2 text-left text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50"
              >
                {showAllChats ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {!collapsed && <SidebarFeedback pathname={pathname} />}
      </div>

      <Dialog open={isDeleteSelectedOpen} onOpenChange={setIsDeleteSelectedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected chats</DialogTitle>
            <DialogDescription>
              {selectedChatIds.length === 1
                ? "This permanently removes the selected chat and all of its saved messages."
                : `This permanently removes ${selectedChatIds.length} selected chats and all of their saved messages.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteSelectedOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteSelectedChats()}
              disabled={selectedChatIds.length === 0 || isDeletingSelected}
            >
              {isDeletingSelected ? <MoreHorizontal className="h-4 w-4 animate-pulse" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border-t p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full justify-center px-2"
                onClick={() => void handleSignOut()}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
                  {initials}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {displayName}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/50">
            <div className="min-w-0 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{displayName}</p>
                {displayEmail && (
                  <p className="truncate text-xs text-sidebar-foreground/60">{displayEmail}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void handleSignOut()}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

    </aside>
  );
}
