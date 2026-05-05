"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, StopCircle, RefreshCw, Terminal, Globe, History, Cpu, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BrowserSessionEvent } from "@/lib/browser-use/session-store";

interface BrowserLiveViewerProps {
  sessionId: string;
  allowManualControl?: boolean;
  onClose?: () => void;
}

export function BrowserLiveViewer({
  sessionId,
  allowManualControl = true,
  onClose,
}: BrowserLiveViewerProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [commandMode, setCommandMode] = useState<"auto" | "task" | "python">("auto");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("live");
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveLogRef = useRef<HTMLDivElement>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/browser/sessions/${sessionId}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to fetch session");
      setSession(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    if (liveLogRef.current) {
      liveLogRef.current.scrollTop = liveLogRef.current.scrollHeight;
    }
  }, [session?.stdout, session?.stderr, session?.events, activeTab]);

  const sessionEvents = useMemo(() => {
    const events = Array.isArray(session?.events) ? (session.events as BrowserSessionEvent[]) : [];
    if (events.length > 0) {
      return events;
    }

    const fallback: BrowserSessionEvent[] = [];
    for (const [index, line] of (session?.stdout || []).entries()) {
      fallback.push({
        id: `stdout-${index}`,
        kind: line.startsWith("__EXIT_CODE__") ? "session-end" : "stdout",
        channel: "stdout",
        timestamp: session?.createdAt ?? Date.now(),
        message: line,
      });
    }
    for (const [index, line] of (session?.stderr || []).entries()) {
      fallback.push({
        id: `stderr-${index}`,
        kind: "stderr",
        channel: "stderr",
        timestamp: session?.createdAt ?? Date.now(),
        message: line,
      });
    }
    return fallback;
  }, [session]);

  const liveUrl = useMemo(() => {
    const latestSnapshot = [...sessionEvents].reverse().find((event) => typeof event?.url === "string" && event.url);
    if (latestSnapshot?.url) {
      return latestSnapshot.url as string;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const taskText = typeof session?.task === "string" ? session.task : "";
    const taskMatch = taskText.match(urlRegex);
    return taskMatch ? taskMatch[0] : null;
  }, [session?.task, sessionEvents]);

  const runTerminalCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || sending) return;

    setSending(true);
    const prefix = commandMode === "auto" ? "" : `${commandMode}: `;
    const payload = `${prefix}${command}`;

    try {
      const res = await fetch(`/api/browser/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: payload }),
      });
      if (res.ok) {
        setCommand("");
        fetchSession();
      } else {
        const result = await res.json().catch(() => null);
        toast.error(result?.error ?? "Failed to send command");
      }
    } catch (err) {
      toast.error("Error sending command");
    } finally {
      setSending(false);
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetch(`/api/browser/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Browser session stopped");
        if (onClose) onClose();
      }
    } catch (err) {
      toast.error("Failed to stop session");
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    await runTerminalCommand(e);
  };

  const hasExited =
    (typeof session?.exitCode === "number" && session.exitCode !== null) ||
    typeof session?.signalCode === "string";
  const statusLabel = session?.isRunning ? "Running" : hasExited ? "Closed" : "Stopped";

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
        <p>Error: {error}</p>
        <Button onClick={fetchSession} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  const logs = [...(session?.stdout || []), ...(session?.stderr || [])];

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-sky-500" />
                <CardTitle className="text-sm font-semibold tracking-tight">
                  Rearvy Computer
                </CardTitle>
                {session?.isRunning ? (
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                ) : (
                  <span className="flex h-2 w-2 rounded-full bg-slate-500" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Live browser stream, replay history, and terminal execution in one place.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-border/70 text-[11px] uppercase tracking-[0.16em]">
                {statusLabel}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchSession}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStop}
                disabled={!session?.isRunning}
                className="h-8 w-8 text-muted-foreground hover:text-red-500"
              >
                <StopCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
              Session {session?.id ?? sessionId}
            </span>
            {session?.exitCode !== undefined && session?.exitCode !== null ? (
              <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
                Exit code {String(session.exitCode)}
              </span>
            ) : null}
            {session?.signalCode ? (
              <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
                Signal {String(session.signalCode)}
              </span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col gap-0">
          <div className="border-b border-border/50 bg-background/60 px-4 py-3">
            <TabsList className="grid w-full grid-cols-3 bg-muted/70">
              <TabsTrigger value="live" className="gap-2">
                <PlayCircle className="h-4 w-4" />
                Live
              </TabsTrigger>
              <TabsTrigger value="replay" className="gap-2">
                <History className="h-4 w-4" />
                Replay
              </TabsTrigger>
              <TabsTrigger value="terminal" className="gap-2">
                <Cpu className="h-4 w-4" />
                Terminal
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="live" className="m-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden">
              {liveUrl && (
                <div className="flex-1 min-h-[46%] border-b border-border/50">
                  <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-mono text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span className="truncate">{liveUrl}</span>
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore - webview is an Electron specific tag enabled in main.cjs */}
                  <webview
                    src={liveUrl}
                    className="h-full w-full border-none bg-white"
                    title="Live Browser DOM"
                  />
                </div>
              )}

              <div
                className={cn(
                  "flex-1 overflow-y-auto p-4 font-mono text-xs",
                  liveUrl ? "min-h-[30%]" : "min-h-full"
                )}
                ref={liveLogRef}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Live output
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {sessionEvents.length} event{sessionEvents.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={cn(
                        "break-words rounded-md border px-2 py-1.5",
                        log.startsWith("__EXIT_CODE__")
                          ? "border-slate-700/60 bg-slate-900/40 text-slate-400 italic"
                          : "border-border/60 bg-background/50 text-slate-200"
                      )}
                    >
                      <span className="mr-2 text-slate-500">[{i}]</span>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="replay" className="m-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Replay timeline
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every browser step, command, and terminal result stays attached to the session.
                  </p>
                </div>
                <Badge variant="outline" className="border-border/70 text-[11px]">
                  {sessionEvents.length} records
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto pr-1" ref={scrollRef}>
                <div className="space-y-3">
                  {sessionEvents.map((event, index) => {
                    const isStep = event.kind === "step";
                    const isPython = event.kind === "python-result" || event.kind === "python-start";
                    const isTask = event.kind === "task-start" || event.kind === "task-complete";
                    const badgeTone = isStep
                      ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                      : isPython
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                        : isTask
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                          : "border-border/60 bg-muted/30 text-muted-foreground";

                    return (
                      <div key={event.id || index} className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px] uppercase tracking-[0.18em]", badgeTone)}>
                            {event.kind.replace(/-/g, " ")}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "now"}
                          </span>
                          {typeof event.step === "number" ? (
                            <span className="text-[11px] text-muted-foreground">step {event.step}</span>
                          ) : null}
                          {typeof event.mode === "string" ? (
                            <span className="text-[11px] text-muted-foreground">mode {event.mode}</span>
                          ) : null}
                        </div>

                        {event.message ? (
                          <p className="text-sm leading-6 text-foreground/90">{event.message}</p>
                        ) : null}

                        {event.task ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            <span className="font-medium text-foreground">Task:</span> {event.task}
                          </p>
                        ) : null}

                        {event.command ? (
                          <p className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2 font-mono text-xs text-slate-200">
                            {event.command}
                          </p>
                        ) : null}

                        {event.url ? (
                          <p className="mt-2 truncate font-mono text-xs text-sky-200">
                            {event.url}
                          </p>
                        ) : null}

                        {event.evaluation || event.memory || event.nextGoal ? (
                          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                            {event.evaluation ? <p><span className="font-medium text-foreground">Evaluation:</span> {event.evaluation}</p> : null}
                            {event.memory ? <p><span className="font-medium text-foreground">Memory:</span> {event.memory}</p> : null}
                            {event.nextGoal ? <p><span className="font-medium text-foreground">Next goal:</span> {event.nextGoal}</p> : null}
                          </div>
                        ) : null}

                        {Array.isArray(event.actions) && event.actions.length > 0 ? (
                          <div className="mt-3 rounded-xl border border-border/60 bg-background/60 p-2 font-mono text-[11px] text-slate-200">
                            {JSON.stringify(event.actions, null, 2)}
                          </div>
                        ) : null}

                        {event.output ? (
                          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-100 whitespace-pre-wrap">
                            {typeof event.output === "string" ? event.output : JSON.stringify(event.output, null, 2)}
                          </div>
                        ) : null}

                        {event.error ? (
                          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-2 font-mono text-[11px] text-red-100 whitespace-pre-wrap">
                            {event.error}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="terminal" className="m-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" />
                    Terminal
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use Python for direct terminal execution. Plain text becomes a follow-up browser task.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["auto", "task", "python"] as const).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={commandMode === mode ? "default" : "outline"}
                      className={cn(
                        "h-8 px-3 text-[11px] uppercase tracking-[0.18em]",
                        commandMode === mode ? "bg-sky-500 text-white hover:bg-sky-600" : ""
                      )}
                      onClick={() => setCommandMode(mode)}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mb-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                Auto mode detects Python syntax. Example: browser.goto("https://google.com")
              </div>

              {allowManualControl && session?.isRunning ? (
                <form onSubmit={handleSendCommand} className="mt-auto flex gap-2">
                  <div className="relative flex-1">
                    <Terminal className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder={
                        commandMode === "python"
                          ? "browser.goto('https://google.com')"
                          : commandMode === "task"
                            ? "Open google.com and wait for the page to load"
                            : "Python code or browser instruction"
                      }
                      className="w-full rounded-md border border-border/50 bg-background/60 py-2 pl-9 pr-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                      disabled={sending}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sending || !command.trim()}
                    className="bg-sky-500 text-white hover:bg-sky-600"
                  >
                    {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run"}
                  </Button>
                </form>
              ) : (
                <div className="mt-auto rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  This session is closed. Replay remains available above.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
