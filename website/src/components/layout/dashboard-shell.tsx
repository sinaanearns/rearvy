"use client";

import { useEffect } from "react";
import { useSidebar } from "./sidebar-provider";
import { Sidebar } from "./sidebar";
import { WorkspaceExplorer } from "@/components/workspace/workspace-explorer";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface RecentChat {
    id: string;
    title: string | null;
    updated_at: string | null;
}

interface Project {
    id: string;
    name: string;
}

interface DashboardShellProps {
    children: React.ReactNode;
    userName: string | null;
    userEmail: string | null;
    recentChats: RecentChat[];
    projects: Project[];
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

    // Viewport scroll lock on chat routes to prevent viewport overflow scroll
    // and ensure all columns (chat, browser workspace, sidebar) are correctly 
    // bounded by the screen height.
    useEffect(() => {
        if (isChatRoute) {
            const html = document.documentElement;
            const body = document.body;
            html.classList.add("overflow-hidden", "h-screen");
            body.classList.add("overflow-hidden", "h-screen");
            return () => {
                html.classList.remove("overflow-hidden", "h-screen");
                body.classList.remove("overflow-hidden", "h-screen");
            };
        }
    }, [isChatRoute]);

    return (
        <div
            className={cn(
                "overflow-x-hidden",
                isChatRoute ? "h-screen lg:h-dvh overflow-hidden" : "min-h-screen"
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
                        <WorkspaceExplorer variant="panel" />
                    </div>
                )}
            </div>
        </div>
    );
}
