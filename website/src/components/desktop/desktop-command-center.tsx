"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { cn } from "@/lib/utils";
import { isElectron } from "@/lib/utils/env";
import {
  Activity,
  ArrowRight,
  Bot,
  CircleDashed,
  Clock3,
  Download,
  LayoutGrid,
  PencilLine,
  RefreshCcw,
  Rocket,
  SquareTerminal,
  Sparkles,
  Workflow,
} from "lucide-react";

type RecentChat = {
  id: string;
  title: string | null;
  updated_at: string | null;
};

type Project = {
  id: string;
  name: string;
};

type DesktopCapabilities = {
  appVersion?: string;
  bridgeVersion?: string;
  rendererBridgeVersion?: string;
  localApi?: { available?: boolean; port?: number | null };
  terminal?: boolean;
  automation?: boolean;
  clicky?: boolean;
  error?: string;
};

type DesktopUpdateState = Record<string, unknown> | null;
type DesktopElectronBridge = NonNullable<Window["electron"]> & {
  getCapabilities?: () => Promise<DesktopCapabilities>;
};

interface DesktopCommandCenterProps {
  userName: string | null;
  userEmail: string | null;
  recentChats: RecentChat[];
  projects: Project[];
  children: React.ReactNode;
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "recent";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recent";
  }

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function readStatusLabel(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const keys = ["status", "state", "phase", "mode", "message"];
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) {
      return record[key] as string;
    }
  }

  return fallback;
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.26em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

export function DesktopCommandCenter({
  userName,
  userEmail,
  recentChats,
  projects,
  children,
}: DesktopCommandCenterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const electron = typeof window !== "undefined" ? (window.electron as DesktopElectronBridge | undefined) : undefined;
  const [capabilities, setCapabilities] = useState<DesktopCapabilities | null>(null);
  const [updateState, setUpdateState] = useState<DesktopUpdateState>(null);
  const [automationState, setAutomationState] = useState<unknown>(null);
  const [clickyState, setClickyState] = useState<unknown>(null);

  const activeChatId = useMemo(() => {
    const match = pathname?.match(/\/desktop\/chat\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    const loadBridgeState = async () => {
      if (!isElectron() || !electron) {
        setCapabilities(null);
        setUpdateState(null);
        setAutomationState(null);
        setClickyState(null);
        return;
      }

      try {
        const nextCapabilities = await electron.getCapabilities?.();
        if (active && nextCapabilities) {
          setCapabilities(nextCapabilities);
        }
      } catch (error) {
        if (active) {
          setCapabilities({ error: error instanceof Error ? error.message : String(error) });
        }
      }

      try {
        const nextUpdateState = await electron.updater?.getState?.();
        if (active) {
          setUpdateState(nextUpdateState ?? null);
        }
      } catch {
        if (active) {
          setUpdateState(null);
        }
      }

      try {
        const nextAutomationState = await electron.automation?.getState?.();
        if (active) {
          setAutomationState(nextAutomationState ?? null);
        }
      } catch {
        if (active) {
          setAutomationState(null);
        }
      }
    };

    void loadBridgeState();

    const removeUpdateListener = electron?.updater?.onStateChange?.((state) => {
      setUpdateState(state ?? null);
    });

    const removeAutomationListener = electron?.automation?.onStateChange?.((state) => {
      setAutomationState(state);
    });

    const removeClickyListener = electron?.clicky?.onStatus?.((status) => {
      setClickyState(status);
    });

    return () => {
      active = false;
      removeUpdateListener?.();
      removeAutomationListener?.();
      removeClickyListener?.();
    };
  }, []);

  const bridgeLabel = !isElectron()
    ? "Browser runtime"
    : capabilities?.error
      ? "Bridge error"
      : capabilities?.bridgeVersion
        ? `Bridge ${capabilities.bridgeVersion}`
        : "Bridge connected";

  const apiPort = capabilities?.localApi?.port ?? "n/a";
  const appVersion = capabilities?.appVersion ?? "n/a";
  const updateAvailable = Boolean((updateState as Record<string, unknown> | null)?.updateAvailable);
  const downloaded = Boolean((updateState as Record<string, unknown> | null)?.downloaded);
  const downloading = Boolean((updateState as Record<string, unknown> | null)?.downloading);
  const currentVersion = (updateState as Record<string, unknown> | null)?.currentVersion;
  const latestVersion = (updateState as Record<string, unknown> | null)?.latestVersion;
  const automationLabel = readStatusLabel(automationState, isElectron() ? "idle" : "unavailable");
  const clickyLabel = readStatusLabel(clickyState, isElectron() ? "idle" : "unavailable");

  const openFreshChat = () => {
    router.push(`/desktop?fresh=${Date.now()}`);
  };

  const runUpdateAction = async (action: "check" | "download" | "install") => {
    if (!electron?.updater) {
      return;
    }

    if (action === "check") {
      await electron.updater.checkForUpdates();
      return;
    }

    if (action === "download") {
      await electron.updater.downloadUpdate();
      return;
    }

    await electron.updater.installAndRestart();
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_30%),linear-gradient(180deg,_#05070b_0%,_#080c13_100%)] text-slate-100">
      <div className="mx-auto grid min-h-dvh w-full gap-3 p-3 xl:grid-cols-[16rem_minmax(0,1fr)_22rem] xl:p-4">
        <aside className="flex min-h-0 flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-[#0a0f17]/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Desktop workspace</p>
                <h1 className="truncate text-lg font-semibold text-slate-50">Rearvy command center</h1>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <CircleDashed className="h-3.5 w-3.5 text-emerald-300" />
              <span>{userName ?? userEmail ?? "Signed in"}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="px-1 text-[10px] uppercase tracking-[0.28em] text-slate-500">Primary actions</p>
            <div className="mt-3 grid gap-2">
              <Button className="h-10 justify-start rounded-xl bg-emerald-500 px-3 text-left text-sm font-medium text-slate-950 hover:bg-emerald-400" onClick={openFreshChat}>
                <PencilLine className="mr-2 h-4 w-4" />
                New chat
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-xl border-white/10 bg-white/5 px-3 text-left text-sm text-slate-200 hover:bg-white/10" onClick={() => runUpdateAction("check")}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Check updates
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-xl border-white/10 bg-white/5 px-3 text-left text-sm text-slate-200 hover:bg-white/10" onClick={() => router.push("/terminal")}>
                <SquareTerminal className="mr-2 h-4 w-4" />
                Open terminal
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Recent chats</p>
                <p className="text-xs text-slate-400">Jump back in</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </div>
            <div className="max-h-[26rem] overflow-y-auto p-2">
              {recentChats.length > 0 ? (
                <div className="space-y-1.5">
                  {recentChats.slice(0, 8).map((chat) => {
                    const isActive = activeChatId === chat.id;
                    return (
                      <Link
                        key={chat.id}
                        href={`/desktop/chat/${chat.id}`}
                        className={cn(
                          "block rounded-xl border px-3 py-2 transition-colors",
                          isActive
                            ? "border-emerald-400/30 bg-emerald-500/10"
                            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">{chat.title ?? "Untitled chat"}</p>
                            <p className="mt-1 text-xs text-slate-500">{chat.id.slice(0, 8)} · {formatRelativeTime(chat.updated_at)}</p>
                          </div>
                          {isActive ? <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400" /> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  No recent chats yet. Start a new session from the command rail.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Projects</p>
                <p className="text-xs text-slate-400">Recent workspaces</p>
              </div>
              <LayoutGrid className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 space-y-2">
              {projects.length > 0 ? (
                projects.slice(0, 5).map((project) => (
                  <div key={project.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <p className="truncate text-sm font-medium text-slate-100">{project.name}</p>
                    <p className="text-xs text-slate-500">Project workspace</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-400">
                  Projects will appear here once they are loaded from the dashboard profile.
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-3 xl:pt-0">
          <div className="rounded-[1.75rem] border border-white/10 bg-[#0a0f17]/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Assistant workspace</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">{pathname === "/desktop" ? "New desktop chat" : `Chat ${activeChatId ?? "workspace"}`}</span>
                  <span className="text-slate-500">·</span>
                  <span>{bridgeLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <StatusPill label="App" value={appVersion} />
                <StatusPill label="API" value={`localhost:${apiPort}`} />
              </div>
            </div>
            <div className="min-h-[34rem] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#090d14]">
              <div className="h-full min-h-[34rem]">{children}</div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[#0a0f17]/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Local terminal</p>
                <p className="text-sm text-slate-400">Docked execution panel</p>
              </div>
              <Bot className="h-4 w-4 text-emerald-300" />
            </div>
            <div className="h-[20rem] min-h-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/30">
              <TerminalPanel />
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 rounded-[1.75rem] border border-white/10 bg-[#0a0f17]/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Bridge health</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-slate-400">Runtime</span>
                <span className="font-medium text-slate-100">{isElectron() ? "Electron" : "Browser"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-slate-400">Bridge</span>
                <span className="font-medium text-slate-100">{capabilities?.bridgeVersion ?? bridgeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-slate-400">Local API</span>
                <span className="font-medium text-slate-100">{apiPort}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-slate-400">Terminal</span>
                <span className="font-medium text-slate-100">{capabilities?.terminal ? "Ready" : "Unavailable"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-slate-400">Clicky</span>
                <span className="font-medium text-slate-100">{capabilities?.clicky ? clickyLabel : "Unavailable"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Automation</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-slate-400">State</p>
                <p className="mt-1 font-medium text-slate-100">{capabilities?.automation ? automationLabel : "Unavailable"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-slate-400">Renderer bridge</p>
                <p className="mt-1 font-medium text-slate-100">{capabilities?.rendererBridgeVersion ?? "n/a"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-slate-400">Current user</p>
                <p className="mt-1 truncate font-medium text-slate-100">{userEmail ?? userName ?? "Signed in"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Updates</p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <StatusPill label="Current" value={String(currentVersion ?? appVersion)} />
                <StatusPill label="Latest" value={String(latestVersion ?? "n/a")} />
              </div>
              <div className="grid gap-2">
                <Button variant="outline" className="h-10 justify-start rounded-xl border-white/10 bg-white/5 px-3 text-left text-sm text-slate-200 hover:bg-white/10" onClick={() => runUpdateAction("check")}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Check for updates
                </Button>
                <Button
                  variant="outline"
                  className="h-10 justify-start rounded-xl border-white/10 bg-white/5 px-3 text-left text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
                  onClick={() => runUpdateAction("download")}
                  disabled={!updateAvailable || downloading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {downloading ? "Downloading..." : downloaded ? "Update downloaded" : "Download update"}
                </Button>
                <Button
                  className="h-10 justify-start rounded-xl bg-emerald-500 px-3 text-left text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:bg-emerald-500/40"
                  onClick={() => runUpdateAction("install")}
                  disabled={!downloaded}
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Install and restart
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Shell status</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <Activity className="h-4 w-4 text-emerald-300" />
                <span>{pathname === "/desktop" ? "Ready for a new chat" : "Active chat workspace"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <Clock3 className="h-4 w-4 text-slate-400" />
                <span>{recentChats.length} recent chats · {projects.length} projects</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <Workflow className="h-4 w-4 text-sky-300" />
                <span>Desktop shell stays local and bridge-aware</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}