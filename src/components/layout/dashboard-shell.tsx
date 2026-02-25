"use client";

import { useSidebar } from "./sidebar-provider";
import { Sidebar } from "./sidebar";
import { MemoryPanel } from "./memory-panel";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";

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

    return (
        <div className="min-h-screen overflow-x-hidden">
            <Sidebar
                userName={userName}
                userEmail={userEmail}
                recentChats={recentChats}
                projects={projects}
            />
            <div
                className={cn(
                    "transition-[padding] duration-300 ease-in-out flex",
                    isOpen ? "md:pl-60" : "md:pl-16"
                )}
            >
                <div className="flex-1 flex flex-col">
                    <Topbar
                        userName={userName}
                        userEmail={userEmail}
                        recentChats={recentChats}
                        projects={projects}
                    />
                    <main className="p-4 md:p-6 flex-1">{children}</main>
                </div>
                {isPanelsOpen && (
                    <div className="hidden md:flex flex-col gap-0">
                        <MemoryPanel />
                    </div>
                )}
            </div>
        </div>
    );
}
