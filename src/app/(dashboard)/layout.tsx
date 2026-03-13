"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const fetchDashboardData = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error("Missing auth token");
        }

        const res = await fetch("/api/dashboard/data", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("Failed to fetch dashboard data");
        }

        const data = await res.json();
        setDashboardData(data);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
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
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || !dashboardData) {
    return null;
  }

  return (
    <SidebarProvider>
      <DashboardShell
        userName={dashboardData.userName}
        userEmail={dashboardData.userEmail}
        recentChats={dashboardData.recentChats}
        projects={dashboardData.projects}
      >
        {children}
      </DashboardShell>
    </SidebarProvider>
  );
}
