"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Lightbulb,
  Plug,
  Sparkles,
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
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "./sidebar-provider";

interface RecentChat {
  id: string;
  title: string | null;
  updated_at: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  recentChats?: RecentChat[];
  projects?: Project[];
}

const navItems = [
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export function Sidebar({
  userName,
  userEmail,
  recentChats = [],
  projects = [],
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen } = useSidebar();

  const initials = userName
    ? userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : userEmail
      ? userEmail[0].toUpperCase()
      : "U";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar md:flex transition-transform duration-300 ease-in-out",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Rearvy</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Main Menu */}
        <div className="px-2 py-4">
          <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50">
            Menu
          </p>
          <div className="space-y-0.5">
            <Link href="/chat">
              <div className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                pathname === "/chat" || pathname === "/chat/new"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
              )}>
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </div>
            </Link>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                  )}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Projects Section */}
        <div className="px-2 py-2">
          <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50">
            Projects
          </p>
          <div className="space-y-0.5">
            <Link href="/projects/new">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors">
                <Plus className="h-4 w-4" />
                <span>New project</span>
              </div>
            </Link>
            {projects.slice(0, 5).map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                  pathname.startsWith(`/projects/${project.id}`)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                )}>
                  <Folder className="h-4 w-4" />
                  <span className="truncate">{project.name}</span>
                </div>
              </Link>
            ))}
            {projects.length > 5 && (
              <Link href="/projects">
                <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                  <span>See more</span>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Your chats Section */}
        <div className="px-2 py-2">
          <p className="px-2 mb-2 text-xs font-medium text-sidebar-foreground/50">
            Your chats
          </p>
          <div className="space-y-0.5">
            {recentChats.map((chat) => (
              <Link key={chat.id} href={`/chat/${chat.id}`}>
                <div className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors",
                  pathname === `/chat/${chat.id}`
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                )}>
                  <span className="truncate">{chat.title || "New Chat"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="border-t p-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              suppressHydrationWarning
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-sidebar-accent/50 focus:outline-none"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col items-start overflow-hidden text-left">
                <span className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
                  {userName || "My Account"}
                </span>
                {userEmail && (
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {userEmail}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
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
