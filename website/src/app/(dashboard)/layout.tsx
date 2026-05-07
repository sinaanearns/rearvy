"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Loader2 } from "lucide-react";

type DashboardData = {
  userName: string | null;
  userEmail: string | null;
  recentChats: Array<{ id: string; title: string; updated_at: string }>;
  projects: Array<{ id: string; name: string }>;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const target = pathname || "/chat";
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }

    const fetchDashboardData = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      try {
        // Force token refresh to ensure we have a valid token for the current user
        const token = await getIdToken();
        if (!token) {
          console.error("Failed to obtain auth token");
          throw new Error("Missing auth token - please sign in again");
        }

        const res = await fetch("/api/dashboard/data", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 401) {
            console.warn("Received 401 from dashboard/data endpoint - token may be invalid");
            // Force sign out and redirect to login if token is invalid
            await (await import("@/lib/firebase/auth")).signOut();
            router.push("/login?error=session_expired");
            return;
          }
          throw new Error(`Failed to fetch dashboard data (${res.status})`);
        }

        const data = await res.json();
        setDashboardData(data);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        // Show default data with current user info even if fetch fails
        setDashboardData({
          userName: user.displayName || null,
          userEmail: user.email || null,
          recentChats: [],
          projects: [],
        });
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, authLoading, router, pathname]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!dashboardData) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <SidebarProvider>
      <DashboardShell
        userName={dashboardData!.userName}
        userEmail={dashboardData!.userEmail}
        recentChats={dashboardData!.recentChats}
        projects={dashboardData!.projects}
      >
        {children}
      </DashboardShell>
    </SidebarProvider>
  );
}
