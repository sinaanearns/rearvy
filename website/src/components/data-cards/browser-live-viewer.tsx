"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  StopCircle,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getIdToken } from "@/lib/firebase/auth";

type BrowserActionLogEntry = {
  id: string;
  action: string;
  status: string;
  message: string;
  timestamp: string;
};

type BrowserSessionPayload = {
  id: string;
  task: string;
  createdAt: number;
  connectionMethod?: "cdp-direct" | "extension-relay" | "managed-runner";
  connectionStatus?: string | null;
  connectedBrowser?: {
    name?: string | null;
    version?: string | null;
    webSocketDebuggerUrl?: string | null;
  } | null;
  extensionRelay?: {
    port?: number | null;
    commandId?: string | null;
    extensionId?: string | null;
  } | null;
  stdout?: string[];
  stderr?: string[];
  isRunning?: boolean;
  pid?: number;
  status?: string;
  currentUrl?: string | null;
  title?: string | null;
  summary?: string | null;
  setupError?: string | null;
  awaitingApproval?: {
    id?: string;
    reason?: string;
    command?: string | null;
  } | null;
  actionLog?: BrowserActionLogEntry[];
  exitCode?: number | null;
  exitedAt?: number | null;
};

interface BrowserLiveViewerProps {
  sessionId: string;
  allowManualControl?: boolean;
  onClose?: () => void;
}

function statusLabel(status?: string, isRunning?: boolean) {
  if (!status) {
    return isRunning ? "Running" : "Idle";
  }

  return status
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status?: string, isRunning?: boolean) {
  if (status === "setup_error" || status === "failed" || status === "timeout") {
    return "text-red-500 bg-red-500/10";
  }
  if (status === "awaiting_approval") {
    return "text-amber-500 bg-amber-500/10";
  }
  if (isRunning) {
    return "text-emerald-500 bg-emerald-500/10";
  }
  return "text-slate-500 bg-slate-500/10";
}

function firstUrl(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(/https?:\/\/[^\s]+/);
    if (match) return match[0];
  }
  return null;
}

async function readErrorMessage(res: Response, fallback: string) {
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  return payload?.error || payload?.message || fallback;
}

export function BrowserLiveViewer({
  sessionId,
  allowManualControl = true,
  onClose,
}: BrowserLiveViewerProps) {
  const [session, setSession] = useState<BrowserSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchWithAuth = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Sign in to view this browser session.");
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/browser/sessions/${sessionId}`);
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to fetch session"));
      }
      const data = (await res.json()) as BrowserSessionPayload;
      setSession(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, sessionId]);

  useEffect(() => {
    void fetchSession();
    const interval = setInterval(fetchSession, 2000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.stdout, session?.stderr, session?.actionLog]);

  const sendSessionCommand = async (nextCommand: string) => {
    if (!nextCommand.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetchWithAuth(`/api/browser/sessions/${sessionId}`, {
        method: "POST",
        body: JSON.stringify({ command: nextCommand }),
      });
      if (res.ok) {
        setCommand("");
        await fetchSession();
      } else {
        toast.error(await readErrorMessage(res, "Failed to send command"));
      }
    } catch {
      toast.error("Error sending command");
    } finally {
      setSending(false);
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetchWithAuth(`/api/browser/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Browser session stopped");
        onClose?.();
      } else {
        toast.error(await readErrorMessage(res, "Failed to stop session"));
      }
    } catch {
      toast.error("Failed to stop session");
    }
  };

  const handleSendCommand = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendSessionCommand(command);
  };

  const handleApprove = async () => {
    const approvalId = session?.awaitingApproval?.id;
    await sendSessionCommand(approvalId ? `approve:${approvalId}` : "approve");
  };

  const handleRetry = async () => {
    if (!session?.task) return;
    await sendSessionCommand(session.task);
  };

  if (loading && !session) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>{error}</p>
        <Button onClick={fetchSession} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  const logs = [...(session?.stdout || []), ...(session?.stderr || [])];
  const url = session?.currentUrl || firstUrl(session?.task, session?.summary);
  const actions = session?.actionLog || [];
  const status = session?.status || (session?.isRunning ? "running" : "closed");
  const needsApproval = status === "awaiting_approval" || Boolean(session?.awaitingApproval);
  const setupError = session?.setupError;
  const canSendCommand = allowManualControl && Boolean(session?.isRunning) && !sending;

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-500" />
              <CardTitle className="truncate text-sm font-semibold tracking-tight">
                {session?.title || "Live Browser Session"}
              </CardTitle>
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {url || "Waiting for browser URL"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium", statusTone(status, session?.isRunning))}>
              {needsApproval ? <ShieldAlert className="h-3 w-3" /> : session?.isRunning ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {statusLabel(status, session?.isRunning)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchSession}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStop}
              disabled={!session?.isRunning}
              className="h-8 w-8 text-muted-foreground hover:text-red-500"
              title="Stop"
            >
              <StopCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        {setupError && (
          <div className="border-b border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium text-red-200">Browser runtime setup failed</div>
                <div className="mt-1 break-words">{setupError}</div>
              </div>
            </div>
          </div>
        )}

        {needsApproval && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  Approval required
                </div>
                <p className="mt-1 break-words text-amber-100/80">
                  {session?.awaitingApproval?.reason || "Rearvy paused before a risky browser action."}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={!canSendCommand}
                className="h-8 shrink-0 bg-amber-500 text-black hover:bg-amber-400"
              >
                Approve
              </Button>
            </div>
          </div>
        )}

        {url && (
          <div className="flex min-h-[42%] flex-1 flex-col border-b border-border/50">
            <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-1.5 font-mono text-xs text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">{url}</span>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-ignore - webview is an Electron specific tag enabled in main.cjs */}
            <webview
              src={url}
              className="w-full flex-1 border-none bg-white"
              title="Browser preview"
            />
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr]">
          {session?.summary && (
            <div className="border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Latest result: </span>
              {session.summary}
            </div>
          )}

          <div className="min-h-0 overflow-y-auto p-4 font-mono text-xs" ref={scrollRef}>
            {actions.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="font-sans text-[11px] font-medium uppercase text-muted-foreground">
                  Recent actions
                </div>
                {actions.slice(-8).map((entry) => (
                  <div key={entry.id} className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{entry.action}</span>
                      <span>{statusLabel(entry.status)}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-foreground/80">
                      {entry.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">No browser output yet.</div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={`${index}-${log}`}
                    className={cn(
                      "break-words",
                      log.startsWith("__EXIT_CODE__")
                        ? "text-slate-500 italic"
                        : log.toLowerCase().includes("error")
                          ? "text-red-300"
                          : "text-slate-300"
                    )}
                  >
                    <span className="mr-2 text-slate-500">[{index}]</span>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {allowManualControl && (
          <div className="border-t border-border/50 bg-muted/20 p-3">
            <form onSubmit={handleSendCommand} className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Terminal className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder={
                    needsApproval
                      ? "Send approve:<id> or use Approve"
                      : "Type a command, e.g. go to pricing"
                  }
                  className="w-full rounded-md border border-border/50 bg-background/50 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  disabled={!canSendCommand}
                />
              </div>
              <Button type="submit" size="sm" disabled={!canSendCommand || !command.trim()}>
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRetry}
                disabled={!canSendCommand || !session?.task}
                title="Retry task"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
