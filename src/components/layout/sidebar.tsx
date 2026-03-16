"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  Plug,
  Plus,
  LogOut,
  User,
  ChevronsUpDown,
  Folder,
  MoreHorizontal,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { signOut } from "@/lib/firebase/auth";
import { SidebarFeedback } from "@/components/layout/sidebar-feedback";
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

const navItems = [
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/integrations", label: "Integrations", icon: Plug },
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
  variant = "desktop",
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen } = useSidebar();
  const { user } = useAuth();
  const [showAllChats, setShowAllChats] = useState(false);
  const [recentChats, setRecentChats] = useState<SidebarChatRecord[]>([]);
  const [projects, setProjects] = useState<SidebarChatProject[]>([]);

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

  const initials = user?.displayName
    ? user.displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : user?.email
      ? user.email[0].toUpperCase()
      : "U";

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
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
  }

  function handleProjectCreated(project: SidebarChatProject) {
    setProjects((currentProjects) => {
      if (currentProjects.some((currentProject) => currentProject.id === project.id)) {
        return currentProjects;
      }

      return sortProjects([project, ...currentProjects]);
    });
  }

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
        {collapsed ? (
          <Image
            src="/websbite-logo.png"
            alt="Rearvy icon"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-lg object-cover"
            priority
          />
        ) : (
          <Image
            src="/rearvy-wordmark.svg"
            alt="Rearvy"
            width={152}
            height={38}
            className="h-9 w-auto dark:invert"
            priority
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
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
                isActive={pathname.startsWith(item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>

        {collapsed && <Separator className="mx-auto w-8" />}

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
            <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50">
              Your chats
            </p>
            <div
              className={cn(
                "space-y-0.5",
                showAllChats && "max-h-48 overflow-y-auto"
              )}
            >
              {(showAllChats ? recentChats : recentChats.slice(0, 5)).map(
                (chat) => (
                  <SidebarChatItem
                    key={chat.id}
                    chat={chat}
                    pathname={pathname}
                    projects={projects}
                    currentUserId={user?.uid ?? null}
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

      {/* User Profile Footer */}
      <div className="border-t p-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              suppressHydrationWarning
              className={cn(
                "flex w-full items-center rounded-lg py-2.5 text-sm transition-colors hover:bg-sidebar-accent/50 focus:outline-none",
                collapsed ? "justify-center px-2" : "gap-3 px-2"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-1 flex-col items-start overflow-hidden text-left">
                    <span className="truncate text-sm font-medium leading-tight text-sidebar-foreground whitespace-nowrap">
                      {user?.displayName || "My Account"}
                    </span>
                    {user?.email && (
                      <span className="truncate text-xs text-sidebar-foreground/60 whitespace-nowrap">
                        {user.email}
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align="start"
            className="w-52 mb-1"
          >
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
