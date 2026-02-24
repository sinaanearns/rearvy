"use client";

import { useSidebar } from "./sidebar-provider";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
    children: React.ReactNode;
    userName: string | null;
    userEmail: string | null;
    recentChats: any[];
    projects: any[];
}

export function DashboardShell({
    children,
    userName,
    userEmail,
    recentChats,
    projects,
}: DashboardShellProps) {
    const { isOpen } = useSidebar();

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
                    "transition-[padding] duration-300 ease-in-out",
                    isOpen ? "md:pl-60" : "md:pl-0"
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
