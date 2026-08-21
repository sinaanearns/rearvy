"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getIdToken } from "@/lib/firebase/auth";

type DashboardData = {
  userName: string | null;
  userEmail: string | null;
  recentChats: Array<{ id: string; title: string | null; updated_at: string | null }>;
  projects: Array<{ id: string; name: string }>;
};

const log = createClientLogger("DashboardClientLayout");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getDashboardData(value: unknown): DashboardData | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    userName: normalizeRearvyDisplayText(value.userName),
    userEmail: typeof value.userEmail === "string" && value.userEmail.trim() ? value.userEmail : null,
    recentChats: Array.isArray(value.recentChats)
      ? value.recentChats.flatMap((chat) => {
          if (!isRecord(chat) || typeof chat.id !== "string") {
            return [];
          }

          return [{
            id: chat.id,
            title: normalizeRearvyDisplayText(chat.title),
            updated_at: typeof chat.updated_at === "string" ? chat.updated_at : null,
          }];
        })
      : [],
    projects: Array.isArray(value.projects)
      ? value.projects.flatMap((project) => {
          if (!isRecord(project) || typeof project.id !== "string") {
            return [];
          }

          return [{
            id: project.id,
            name: normalizeRearvyDisplayText(project.name) ?? "Untitled Project",
          }];
        })
      : [],
  };
}

async function readDashboardData(response: Response): Promise<DashboardData | null> {
  const payload = (await response.json().catch(() => null)) as unknown;
  return getDashboardData(payload);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

function getFallbackDashboardData(user: { displayName?: string | null; email?: string | null }): DashboardData {
  return {
    userName: normalizeRearvyDisplayText(user.displayName),
    userEmail: user.email || null,
    recentChats: [],
    projects: [],
  };
}

function DashboardLoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <RearvyLogo
          priority
          markSize={40}
          markClassName="h-10 w-10 rounded-[8px]"
          textClassName="text-2xl text-foreground"
        />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">Loading</p>
      </div>
    </div>
  );
}

export function DashboardClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Do not keep the dashboard loader mounted while navigation to login is
      // in flight. This is especially important in the Electron renderer,
      // where Firebase persistence can resolve after the route transition.
      setLoading(false);
      const target = pathname || "/chat";
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    const fetchDashboardData = async () => {

      try {
        // Force token refresh to ensure we have a valid token for the current user
        const token = await getIdToken();
        if (!token) {
          log.error("Failed to obtain auth token");
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
            log.warn("Received 401 from dashboard/data endpoint - token may be invalid");
            // Force sign out and redirect to login if token is invalid
            await (await import("@/lib/firebase/auth")).signOut();
            router.push("/login?error=session_expired");
            return;
          }
          throw new Error(await readErrorMessage(res, `Failed to fetch dashboard data (${res.status})`));
        }

        const data = await readDashboardData(res);
        setDashboardData(data || getFallbackDashboardData(user));
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        log.error("Error fetching dashboard data:", err);
        // Show default data with current user info even if fetch fails
        setDashboardData(getFallbackDashboardData(user));
      } finally {
        window.clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchDashboardData();

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
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
