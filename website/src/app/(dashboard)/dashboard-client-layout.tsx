"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Database, Loader2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { getIdToken } from "@/lib/firebase/auth";

type DashboardData = {
  userName: string | null;
  userEmail: string | null;
  recentChats: Array<{ id: string; title: string; updated_at: string }>;
  projects: Array<{ id: string; name: string }>;
};

function LoadingStep({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] border border-border/70 bg-background/72 px-3 py-2 text-sm text-muted-foreground shadow-sm">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-border bg-card text-foreground">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function DashboardLoadingScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:72px_72px] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,hsl(var(--primary)),#14b8a6,#f59e0b)]" />
      <div
        className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-10"
        role="status"
        aria-live="polite"
      >
        <div className="w-full max-w-[540px] rounded-[8px] border border-border/80 bg-card/92 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
            <RearvyLogo
              priority
              markSize={34}
              markClassName="h-[34px] w-[34px] rounded-[8px]"
              textClassName="text-xl text-foreground"
            />
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-border bg-background text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-3 py-5">
            <h1 className="text-lg font-semibold">Loading Rearvy</h1>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Preparing your workspace and latest client context.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <LoadingStep icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} label="Session" />
            <LoadingStep icon={<Database className="h-4 w-4" aria-hidden="true" />} label="Workspace" />
            <LoadingStep icon={<Activity className="h-4 w-4" aria-hidden="true" />} label="Live data" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardClientLayout({
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
    return <DashboardLoadingScreen />;
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
