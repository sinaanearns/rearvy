"use client";

import { useSidebar } from "./sidebar-provider";
import { Sidebar } from "./sidebar";
import { RightSidebar } from "./right-sidebar";
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
    const { isOpen, isRightOpen } = useSidebar();

    return (
        <div className="min-h-screen overflow-x-hidden">
            <Sidebar
                userName={userName}
                userEmail={userEmail}
                recentChats={recentChats}
                projects={projects}
            />
            <RightSidebar />
            <div
                className={cn(
                    "transition-[padding] duration-300 ease-in-out",
                    isOpen ? "md:pl-60" : "md:pl-16",
                    isRightOpen ? "md:pr-80" : "md:pr-14"
                )}
            >
                <Topbar
                    userName={userName}
                    userEmail={userEmail}
                    recentChats={recentChats}
                    projects={projects}
                />
                <main className="p-4 md:p-6">{children}</main>
            </div>
        </div>
    );
}
