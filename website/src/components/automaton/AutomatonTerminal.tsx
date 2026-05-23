"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDot,
  Loader2,
  Play,
  RefreshCw,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AutomatonLogLevel = "debug" | "info" | "warn" | "error" | "fatal" | "system";
type AutomatonLogSource = "local-api" | "runner" | "stdout" | "stderr";

type AutomatonLogEvent = {
  id: string;
  timestamp: string;
  level: AutomatonLogLevel;
  source: AutomatonLogSource;
  message: string;
  module?: string;
  pid?: number | null;
};

type AutomatonStatus = {
  available: boolean;
  running: boolean;
  pid: number | null;
  startedAt: string | null;
  lastEventAt: string | null;
  events: AutomatonLogEvent[];
};

type ConnectionState = "checking" | "browser" | "connecting" | "connected" | "error";

const MAX_VISIBLE_EVENTS = 300;

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isAutomatonLogEvent(value: unknown): value is AutomatonLogEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Partial<AutomatonLogEvent>;
  return (
    typeof event.id === "string" &&
    typeof event.timestamp === "string" &&
    typeof event.level === "string" &&
    typeof event.source === "string" &&
    typeof event.message === "string"
  );
}

function isAutomatonStatus(value: unknown): value is AutomatonStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const status = value as Partial<AutomatonStatus>;
  return (
    typeof status.available === "boolean" &&
    typeof status.running === "boolean" &&
    Array.isArray(status.events)
  );
}

function parseEvent<T>(event: MessageEvent<string>) {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

function mergeEvents(current: AutomatonLogEvent[], incoming: AutomatonLogEvent[]) {
  const byId = new Map<string, AutomatonLogEvent>();

  for (const event of current) {
    byId.set(event.id, event);
  }

  for (const event of incoming) {
    byId.set(event.id, event);
  }

  return Array.from(byId.values())
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .slice(-MAX_VISIBLE_EVENTS);
}

function getLevelClass(level: AutomatonLogLevel) {
  if (level === "error" || level === "fatal") {
    return "text-red-300";
  }

  if (level === "warn") {
    return "text-amber-300";
  }

  if (level === "system") {
    return "text-sky-300";
  }

  if (level === "debug") {
    return "text-slate-500";
  }

  return "text-emerald-300";
}

export function AutomatonTerminal() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [localApiBase, setLocalApiBase] = useState<string | null>(null);
  const [status, setStatus] = useState<AutomatonStatus | null>(null);
  const [events, setEvents] = useState<AutomatonLogEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [probeNonce, setProbeNonce] = useState(0);
  const [streamNonce, setStreamNonce] = useState(0);
  const eventsEndRef = useRef<HTMLDivElement | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!localApiBase) {
      return;
    }

    const response = await fetch(`${localApiBase}/api/internal/automaton/status`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Status request failed with ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isAutomatonStatus(payload)) {
      throw new Error("Desktop Automaton status response was malformed.");
    }

    setStatus(payload);
    setEvents((current) => mergeEvents(current, payload.events.filter(isAutomatonLogEvent)));
  }, [localApiBase]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;

    async function probeLocalApi(attempt = 0) {
      if (typeof window === "undefined") {
        return;
      }

      const electron = window.electron;
      if (!electron) {
        setConnectionState("browser");
        setLocalApiBase(null);
        return;
      }

      setConnectionState("checking");

      try {
        const port = await electron.localApiPort?.();
        if (cancelled) {
          return;
        }

        if (typeof port === "number") {
          setLocalApiBase(`http://127.0.0.1:${port}`);
          setConnectionState("connecting");
          setError(null);
          return;
        }

        if (attempt < 12) {
          retryTimer = window.setTimeout(() => void probeLocalApi(attempt + 1), 500);
          return;
        }

        setConnectionState("error");
        setError("Rearvy Desktop local API is not ready.");
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setConnectionState("error");
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    }

    void probeLocalApi();

    const handleBridgeReady = () => {
      void probeLocalApi();
    };

    window.addEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
    window.addEventListener("focus", handleBridgeReady);

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      window.removeEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
      window.removeEventListener("focus", handleBridgeReady);
    };
  }, [probeNonce]);

  useEffect(() => {
    if (!localApiBase) {
      return;
    }

    const eventSource = new EventSource(`${localApiBase}/api/internal/automaton/events`);
    let active = true;

    void refreshStatus().catch((nextError) => {
      if (!active) {
        return;
      }

      setConnectionState("error");
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    });

    eventSource.onopen = () => {
      if (!active) {
        return;
      }

      setConnectionState("connected");
      setError(null);
    };

    eventSource.onerror = () => {
      if (!active) {
        return;
      }

      setConnectionState("error");
      setError("Live Automaton event stream disconnected.");
    };

    eventSource.addEventListener("status", (event) => {
      const payload = parseEvent<unknown>(event as MessageEvent<string>);
      if (isAutomatonStatus(payload)) {
        setStatus(payload);
      }
    });

    eventSource.addEventListener("automaton", (event) => {
      const payload = parseEvent<unknown>(event as MessageEvent<string>);
      if (isAutomatonLogEvent(payload)) {
        setEvents((current) => mergeEvents(current, [payload]));
      }
    });

    return () => {
      active = false;
      eventSource.close();
    };
  }, [localApiBase, refreshStatus, streamNonce]);

  useEffect(() => {
    if (autoScroll) {
      eventsEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [autoScroll, events]);

  const statusLabel = useMemo(() => {
    if (connectionState === "browser") {
      return "desktop required";
    }

    if (connectionState === "connected" && status?.running) {
      return "running";
    }

    if (connectionState === "connected") {
      return "idle";
    }

    return connectionState;
  }, [connectionState, status?.running]);

  const handleStart = useCallback(async () => {
    if (!localApiBase) {
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch(`${localApiBase}/api/internal/automaton/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Start request failed with ${response.status}`);
      }

      await refreshStatus();
    } catch (nextError) {
      setConnectionState("error");
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsStarting(false);
    }
  }, [localApiBase, refreshStatus]);

  const handleReconnect = useCallback(() => {
    setError(null);
    if (localApiBase) {
      setConnectionState("connecting");
      setStreamNonce((current) => current + 1);
    } else {
      setConnectionState("checking");
      setProbeNonce((current) => current + 1);
    }
  }, [localApiBase]);

  const canStart = connectionState === "connected" && Boolean(status?.available) && !isStarting;

  if (connectionState === "browser") {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950/50">
        <div className="max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
            <Bot className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-950 dark:text-slate-50">
            Rearvy Desktop required
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
            The Automaton terminal shows real local runner output. Open this page in Rearvy Desktop to connect to the local Automaton API.
          </p>
          <Button
            type="button"
            className="mt-6 h-10 rounded-lg bg-sky-600 text-white hover:bg-sky-700"
            onClick={() => window.open("https://www.rearvy.com/download", "_blank")}
          >
            <Bot className="h-4 w-4" />
            Download Desktop
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-emerald-300 dark:bg-black">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                  Rearvy Automaton
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                    status?.running && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  )}
                >
                  <CircleDot className={cn("h-3 w-3", status?.running && "text-emerald-500")} />
                  {statusLabel}
                </Badge>
                {typeof status?.pid === "number" ? (
                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    PID {status.pid}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Real-time runner output from the desktop local API.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleStart} disabled={!canStart}>
              {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Start
            </Button>
            <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={handleReconnect}>
              <RefreshCw className="h-4 w-4" />
              Reconnect
            </Button>
            <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => setEvents([])}>
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button type="button" variant={autoScroll ? "secondary" : "outline"} className="h-9 rounded-lg" onClick={() => setAutoScroll((current) => !current)}>
              {autoScroll ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}
              Auto-scroll
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <span className="font-medium text-slate-700 dark:text-slate-200">Connection:</span>{" "}
            {connectionState === "connected" ? "live stream connected" : connectionState}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <span className="font-medium text-slate-700 dark:text-slate-200">Started:</span>{" "}
            {formatTime(status?.startedAt)}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            <span className="font-medium text-slate-700 dark:text-slate-200">Last event:</span>{" "}
            {formatTime(status?.lastEventAt)}
          </div>
        </div>

        {error || status?.available === false ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {error || "Automaton runtime is unavailable. Check AUTO-START-AUTOMATON.md or set REARVY_AUTOMATON_DIR."}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[#101214]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {connectionState === "connected" ? <Wifi className="h-3.5 w-3.5 text-emerald-300" /> : <WifiOff className="h-3.5 w-3.5 text-amber-300" />}
            <span>{events.length} events</span>
          </div>
          <span>{localApiBase ?? "local API pending"}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-6">
          {connectionState === "checking" || connectionState === "connecting" ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting to Rearvy Desktop Automaton...
            </div>
          ) : events.length === 0 ? (
            <div className="text-slate-500">Waiting for real Automaton output.</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="grid gap-2 border-b border-white/[0.04] py-1.5 sm:grid-cols-[5.5rem_5rem_5rem_1fr]">
                <span className="text-slate-500">{formatTime(event.timestamp)}</span>
                <span className={cn("uppercase", getLevelClass(event.level))}>{event.level}</span>
                <span className="text-slate-500">{event.source}</span>
                <span className="min-w-0 whitespace-pre-wrap break-words text-slate-200">
                  {event.module ? <span className="text-slate-500">[{event.module}] </span> : null}
                  {event.message}
                </span>
              </div>
            ))
          )}
          <div ref={eventsEndRef} />
        </div>
      </div>
    </div>
  );
}
