"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Database, Loader2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getIdToken } from "@/lib/firebase/auth";

type DashboardData = {
  userName: string | null;
  userEmail: string | null;
  recentChats: Array<{ id: string; title: string | null; updated_at: string | null }>;
  projects: Array<{ id: string; name: string }>;
};

type LoadingStepTone = "cyan" | "emerald" | "amber";

const loadingStepToneClasses: Record<LoadingStepTone, string> = {
  cyan: "border-cyan-200/55 bg-cyan-100/55 text-cyan-700 dark:border-cyan-200/20 dark:bg-cyan-200/10 dark:text-cyan-100",
  emerald:
    "border-emerald-200/55 bg-emerald-100/55 text-emerald-700 dark:border-emerald-200/20 dark:bg-emerald-200/10 dark:text-emerald-100",
  amber:
    "border-amber-200/60 bg-amber-100/60 text-amber-700 dark:border-amber-200/20 dark:bg-amber-200/10 dark:text-amber-100",
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
    userName: typeof value.userName === "string" && value.userName.trim() ? value.userName : null,
    userEmail: typeof value.userEmail === "string" && value.userEmail.trim() ? value.userEmail : null,
    recentChats: Array.isArray(value.recentChats)
      ? value.recentChats.flatMap((chat) => {
          if (!isRecord(chat) || typeof chat.id !== "string") {
            return [];
          }

          return [{
            id: chat.id,
            title: typeof chat.title === "string" && chat.title.trim() ? chat.title : null,
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
            name: typeof project.name === "string" && project.name.trim()
              ? project.name
              : "Untitled Project",
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
    userName: user.displayName || null,
    userEmail: user.email || null,
    recentChats: [],
    projects: [],
  };
}

function LoadingStep({
  icon,
  label,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  tone: LoadingStepTone;
}) {
  return (
    <div className="group grid min-h-[76px] min-w-0 grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-border/70 bg-background/80 px-3 py-3 text-sm shadow-sm shadow-slate-950/[0.03] transition-colors hover:border-border dark:border-white/10 dark:bg-white/[0.055] dark:hover:border-white/18">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border ${loadingStepToneClasses[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-foreground dark:text-white">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground dark:text-slate-400">
          {detail}
        </span>
      </span>
    </div>
  );
}

const loadingSteps = [
  {
    icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
    label: "Session",
    detail: "Checking access",
    tone: "cyan",
  },
  {
    icon: <Database className="h-4 w-4" aria-hidden="true" />,
    label: "Workspace",
    detail: "Loading context",
    tone: "emerald",
  },
  {
    icon: <Activity className="h-4 w-4" aria-hidden="true" />,
    label: "Live data",
    detail: "Syncing signals",
    tone: "amber",
  },
] satisfies Array<{
  icon: React.ReactNode;
  label: string;
  detail: string;
  tone: LoadingStepTone;
}>;

function DashboardLoadingScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8fafc] text-foreground dark:bg-[#030405]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.055)_1px,transparent_1px)] bg-[size:72px_72px] dark:bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(105,215,255,0.2),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(247,201,72,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.5),rgba(248,250,252,0.94))] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(105,215,255,0.2),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(247,201,72,0.13),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.72))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#69d7ff,#14b8a6,#f59e0b,transparent)]" />
      <div
        className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10"
        role="status"
        aria-live="polite"
      >
        <div className="grid w-full min-w-0 max-w-[calc(100vw_-_40px)] overflow-hidden rounded-[8px] border border-border/75 bg-card/90 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/82 dark:shadow-black/35 sm:max-w-4xl md:grid-cols-[minmax(0,0.88fr)_minmax(360px,1fr)]">
          <section className="relative min-w-0 overflow-hidden border-b border-border/70 p-5 dark:border-white/10 sm:p-6 md:border-b-0 md:border-r">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(105,215,255,0.12),transparent_48%),linear-gradient(260deg,rgba(247,201,72,0.12),transparent_52%)]"
            />
            <div className="relative flex items-start justify-between gap-4">
              <RearvyLogo
                priority
                markSize={38}
                markClassName="h-[38px] w-[38px] rounded-[8px]"
                textClassName="text-xl text-foreground dark:text-white"
              />
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] border border-border bg-background/85 text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              </div>
            </div>

            <div className="relative mt-8 space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-white">
                Loading Rearvy
              </h1>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground dark:text-slate-300">
              Preparing your workspace and latest client context.
              </p>
            </div>

            <div className="relative mt-7">
              <div className="h-2 overflow-hidden rounded-full border border-border/70 bg-background/70 dark:border-white/10 dark:bg-white/[0.06]">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-[linear-gradient(90deg,#69d7ff,#14b8a6,#f7c948)]" />
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs font-medium text-muted-foreground dark:text-slate-400">
                <span className="truncate">Securing session</span>
                <span className="truncate text-right">Preparing workspace</span>
              </div>
            </div>
          </section>

          <section className="grid min-w-0 content-center gap-3 p-5 sm:p-6">
            {loadingSteps.map((step) => (
              <LoadingStep key={step.label} {...step} />
            ))}
          </section>
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
