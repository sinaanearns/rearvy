"use client";

import { useSidebar } from "./sidebar-provider";
import { Sidebar } from "./sidebar";
import { MemoryPanel } from "./memory-panel";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
    children: React.ReactNode;
    userName: string | null;
    userEmail: string | null;
    recentChats: RecentChat[];
    projects: Project[];
}

interface RecentChat {
    id: string;
    title: string | null;
    updated_at: string | null;
}

interface Project {
    id: string;
    name: string;
}

export function DashboardShell({
    children,
    userName,
    userEmail,
    recentChats,
    projects,
}: DashboardShellProps) {
    const { isOpen, isPanelsOpen } = useSidebar();
    const pathname = usePathname();
    const isChatRoute = pathname?.split("/").includes("chat") ?? false;

    return (
        <div
            className={cn(
                "overflow-x-hidden",
                isChatRoute ? "h-dvh overflow-hidden" : "min-h-screen"
            )}
        >
            <Sidebar
                userName={userName}
                userEmail={userEmail}
                recentChats={recentChats}
                projects={projects}
            />
            <div
                className={cn(
                    "transition-[padding] duration-300 ease-in-out flex",
                    isChatRoute && "h-full min-h-0 overflow-hidden",
                    isOpen ? "md:pl-60" : "md:pl-16"
                )}
            >
                <div
                    className={cn(
                        "flex flex-1 min-w-0 flex-col",
                        isChatRoute && "min-h-0 overflow-hidden"
                    )}
                >
                    <Topbar
                        userName={userName}
                        userEmail={userEmail}
                        recentChats={recentChats}
                        projects={projects}
                    />
                    <main
                        className={cn(
                            "flex-1",
                            isChatRoute
                                ? "flex min-h-0 overflow-hidden p-0"
                                : "p-4 md:p-6"
                        )}
                    >
                        {children}
                    </main>
                </div>
                {isPanelsOpen && (
                    <div className="hidden md:flex flex-col gap-0 sticky top-0 h-screen">
                        <MemoryPanel variant="desktop" />
                    </div>
                )}
            </div>
        </div>
    );
}
