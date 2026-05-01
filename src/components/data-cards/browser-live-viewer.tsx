"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ExternalLink,
  Globe,
  Loader2,
  MousePointerClick,
  Send,
  RefreshCw,
} from "lucide-react";
import {
  buildBrowserWebSocketUrl,
  type BrowserActionLogEntry,
} from "@/lib/live-browser/shared";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";

type BrowserLiveViewerProps = {
  data: Record<string, unknown>;
  blocker: string | null;
  summary: string;
  task: string | null;
  toneLabel: string;
  fallbackActivityLines: string[];
  className?: string;
  variant?: "card" | "workspace";
  allowManualControl?: boolean;
};

type LiveBrowserState = {
  currentUrl: string | null;
  title: string | null;
  frameDataUrl: string | null;
  viewport: {
    width: number;
    height: number;
  } | null;
  actionLog: BrowserActionLogEntry[];
  lastAction: BrowserActionLogEntry | null;
  status: string | null;
};

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asActionLogArray(value: unknown): BrowserActionLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is BrowserActionLogEntry => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const entry = item as Record<string, unknown>;
    return (
      typeof entry.id === "string" &&
      typeof entry.action === "string" &&
      typeof entry.status === "string" &&
      typeof entry.message === "string" &&
      typeof entry.timestamp === "string"
    );
  });
}

function asViewport(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const width =
    typeof record.width === "number" && Number.isFinite(record.width)
      ? record.width
      : null;
  const height =
    typeof record.height === "number" && Number.isFinite(record.height)
      ? record.height
      : null;

  if (!width || !height) {
    return null;
  }

  return { width, height };
}

function getLiveBrowserState(data: Record<string, unknown>): LiveBrowserState {
  const session = asRecord(data.session) ?? data;
  const rootActionLog = asActionLogArray(data.actionLog);

  return {
    currentUrl: firstNonEmptyString(
      data.currentUrl,
      data.finalUrl,
      data.final_url,
      session.currentUrl
    ),
    title: firstNonEmptyString(data.currentTitle, data.title, session.title),
    frameDataUrl: firstNonEmptyString(
      data.frameDataUrl,
      data.screenshotUrl,
      data.screenshot_url,
      session.frameDataUrl
    ),
    viewport: asViewport(data.viewport) ?? asViewport(session.viewport),
    actionLog: rootActionLog.length > 0 ? rootActionLog : asActionLogArray(session.actionLog),
    lastAction: asRecord(data.lastAction)
      ? (data.lastAction as BrowserActionLogEntry)
      : asRecord(session.lastAction)
        ? (session.lastAction as BrowserActionLogEntry)
        : null,
    status: firstNonEmptyString(data.status, session.status),
  };
}

function formatBrowserTabLabel(url: string | null, fallback: string) {
  if (!url) {
    return fallback;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "") || fallback;
  } catch {
    return fallback;
  }
}

function formatBrowserAddress(url: string | null, fallback: string) {
  if (!url) {
    return fallback;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function normalizeHostname(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/:\d+$/, "").trim() || null;
}

export function BrowserLiveViewer({
  data,
  blocker,
  summary,
  task,
  toneLabel,
  fallbackActivityLines,
  className,
  variant = "card",
  allowManualControl = false,
}: BrowserLiveViewerProps) {
  const { user } = useAuth();
  const session = asRecord(data.session);
  const sessionId = firstNonEmptyString(
    data.browserSessionId,
    data.sessionId,
    session?.sessionId
  );
  const streamToken = firstNonEmptyString(data.streamToken, session?.streamToken);
  const streamPath =
    firstNonEmptyString(data.streamPath, session?.streamPath) ?? "/browser-stream";
  const streamPort = firstFiniteNumber(data.streamPort, session?.streamPort);
  const websocketUrl = firstNonEmptyString(data.websocketUrl);
  const initialState = useMemo(() => getLiveBrowserState(data), [data]);
  const [liveState, setLiveState] = useState<LiveBrowserState>(initialState);
  const [addressInput, setAddressInput] = useState(
    initialState.currentUrl ?? ""
  );
  const [focusedTextInput, setFocusedTextInput] = useState("");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [isSubmittingCommand, setIsSubmittingCommand] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [streamState, setStreamState] = useState<
    "idle" | "connecting" | "live" | "disconnected" | "error"
  >(sessionId ? "connecting" : "idle");
  const frameImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLiveState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (isEditingAddress) {
      return;
    }

    setAddressInput(initialState.currentUrl ?? "");
  }, [initialState.currentUrl, isEditingAddress]);

  useEffect(() => {
    setSessionUnavailable(false);
    setStreamState(sessionId ? "connecting" : "idle");
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !user) {
      return;
    }

    let cancelled = false;

    const loadSession = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/browser/session/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (cancelled) {
            return;
          }

          if (response.status === 404) {
            setSessionUnavailable(true);
            setStreamState("disconnected");
          }
          return;
        }

        const payload = (await response.json()) as Record<string, unknown>;
        if (cancelled) {
          return;
        }

        setSessionUnavailable(false);
        setLiveState(getLiveBrowserState(payload));
      } catch {
        // Leave the last known frame in place.
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId, user]);

  useEffect(() => {
    if (
      !sessionId ||
      !streamToken ||
      sessionUnavailable ||
      typeof window === "undefined"
    ) {
      return;
    }

    const computedUrl =
      websocketUrl ??
      (streamPort
        ? buildBrowserWebSocketUrl({
            port: streamPort,
            sessionId,
            streamToken,
            path: streamPath,
            protocol: window.location.protocol,
            hostname: normalizeHostname(window.location.host) ?? window.location.hostname,
          })
        : null);

    if (!computedUrl) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closedByEffect = false;
    let allowReconnect = true;

    const connect = () => {
      setStreamState("connecting");
      socket = new WebSocket(computedUrl);

      socket.onopen = () => {
        setStreamState("live");
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const eventType = firstNonEmptyString(payload.type);
          const nextSession = asRecord(payload.session);
          if (!nextSession) {
            return;
          }

          setLiveState(getLiveBrowserState(nextSession));

          const nextStatus = firstNonEmptyString(nextSession.status);
          if (eventType === "session_closed" || nextStatus === "closed") {
            allowReconnect = false;
            setSessionUnavailable(true);
            setStreamState("disconnected");
            return;
          }

          setSessionUnavailable(false);
        } catch {
          // Ignore malformed stream events.
        }
      };

      socket.onerror = () => {
        setStreamState("error");
      };

      socket.onclose = (event) => {
        if (closedByEffect) {
          return;
        }

        if (event.code === 1008) {
          allowReconnect = false;
          setSessionUnavailable(true);
          setStreamState("disconnected");
          return;
        }

        if (!allowReconnect) {
          return;
        }

        setStreamState("disconnected");
        reconnectTimer = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [sessionId, sessionUnavailable, streamPath, streamPort, streamToken, websocketUrl]);

  const browserLocation = liveState.currentUrl ?? "Live browser session";
  const browserTabLabel = formatBrowserTabLabel(
    liveState.currentUrl,
    task ?? "browser"
  );
  const browserAddress = formatBrowserAddress(liveState.currentUrl, browserLocation);
  const activityLines =
    liveState.actionLog.length > 0
      ? [...liveState.actionLog]
          .reverse()
          .map((entry) => sanitizeAssistantText(entry.message))
      : fallbackActivityLines;
  const liveBadgeLabel =
    sessionUnavailable
      ? "Session ended"
      : streamState === "live"
        ? "Live stream"
        : streamState === "connecting"
          ? "Connecting"
          : streamState === "disconnected"
            ? "Disconnected"
            : streamState === "error"
              ? "Stream error"
              : toneLabel;
  const isWorkspaceVariant = variant === "workspace";
  const controlsDisabled =
    !sessionId || !user || sessionUnavailable || isSubmittingCommand;
  const manualControlsDisabled = controlsDisabled || !allowManualControl;
  const viewport = liveState.viewport;

  const sendBrowserCommands = async (
    commands: Array<Record<string, unknown>>
  ) => {
    if (!sessionId || !user || commands.length === 0) {
      return;
    }

    setIsSubmittingCommand(true);
    setCommandError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/browser/session/${sessionId}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ commands }),
      });

      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        const errorMessage =
          typeof payload.error === "string"
            ? payload.error
            : "Browser command failed.";
        throw new Error(errorMessage);
      }

      setSessionUnavailable(false);
      setLiveState(getLiveBrowserState(payload));
    } catch (error) {
      setCommandError(
        error instanceof Error ? error.message : "Browser command failed."
      );
    } finally {
      setIsSubmittingCommand(false);
    }
  };

  const handleNavigate = async () => {
    if (!addressInput.trim()) {
      return;
    }

    await sendBrowserCommands([
      {
        action: "goto",
        target: addressInput.trim(),
      },
    ]);
  };

  const handleFocusedType = async () => {
    if (!focusedTextInput.trim()) {
      return;
    }

    await sendBrowserCommands([
      {
        action: "typeFocused",
        value: focusedTextInput,
      },
    ]);
    setFocusedTextInput("");
  };

  const handleFrameClick = async (
    event: React.MouseEvent<HTMLImageElement>
  ) => {
    if (manualControlsDisabled || !viewport || !frameImageRef.current) {
      return;
    }

    const rect = frameImageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    if (
      offsetX < 0 ||
      offsetY < 0 ||
      offsetX > rect.width ||
      offsetY > rect.height
    ) {
      return;
    }

    const scaledX = Math.round((offsetX / rect.width) * viewport.width);
    const scaledY = Math.round((offsetY / rect.height) * viewport.height);

    await sendBrowserCommands([
      {
        action: "click",
        x: scaledX,
        y: scaledY,
      },
    ]);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[28px] border border-zinc-800/70 bg-[#111215] text-zinc-50 shadow-[0_24px_80px_rgba(0,0,0,0.32)]",
        isWorkspaceVariant && "flex h-full min-h-[32rem] flex-col",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#17181d] px-3 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="min-w-0 flex-1 basis-[10rem] rounded-t-2xl border border-white/10 bg-[#23252c] px-3 py-2 text-sm text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:max-w-[18rem]">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span className="truncate">{browserTabLabel}</span>
          </div>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200 sm:ml-auto">
          {liveBadgeLabel}
        </div>
      </div>

      {allowManualControl ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#111215] px-3 py-3">
          <button
            type="button"
            onClick={() => void sendBrowserCommands([{ action: "back" }])}
            disabled={controlsDisabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void sendBrowserCommands([{ action: "forward" }])}
            disabled={controlsDisabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Go forward"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void sendBrowserCommands([{ action: "reload" }])}
            disabled={controlsDisabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Reload page"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-[#20232b] px-2 py-1.5 text-sm text-zinc-200">
            <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <Input
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              onFocus={() => setIsEditingAddress(true)}
              onBlur={() => setIsEditingAddress(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleNavigate();
                }
              }}
              placeholder={browserAddress}
              disabled={controlsDisabled}
              className="h-8 border-0 bg-transparent px-0 py-0 text-sm text-zinc-100 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleNavigate()}
            disabled={controlsDisabled || !addressInput.trim()}
            className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmittingCommand ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Go
          </button>
          {liveState.currentUrl ? (
            <a
              href={liveState.currentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-white/10"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#111215] px-3 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-[#20232b] px-3 py-2 text-sm text-zinc-300">
            <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span className="truncate">{browserAddress}</span>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-100">
            App-controlled
          </span>
        </div>
      )}

      <div
        className={cn(
          "bg-[linear-gradient(180deg,#e9eaef_0%,#d8dae2_100%)] p-3 sm:p-4",
          isWorkspaceVariant && "min-h-0 flex-1"
        )}
      >
        {blocker ? (
          <p className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
            Blocker: {blocker}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200/80 bg-zinc-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {task ?? browserTabLabel}
              </p>
              <p className="truncate text-xs text-zinc-500">{summary}</p>
            </div>
            <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
              {sessionUnavailable ? "ended" : liveState.status ?? toneLabel}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200/80 bg-white px-4 py-3">
            {allowManualControl ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Click inside the page to interact
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
                  Then type below into the focused field
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  View only
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
                  Rearvy controls this browser only for the current app workflow
                </div>
              </>
            )}
          </div>

          {liveState.currentUrl ? (
            // Try to embed the live page when we have a URL. Many sites block embedding
            // via X-Frame-Options/CSP — this is a best-effort fallback to the existing
            // frame image stream when embedding isn't possible.
            <div className="flex justify-center bg-white">
              <div
                className={cn(
                  "w-full overflow-auto bg-white",
                  isWorkspaceVariant
                    ? "max-h-[calc(100vh-19rem)] max-w-[72rem]"
                    : "max-h-[38rem]"
                )}
              >
                <div className="relative w-full bg-white">
                  <iframe
                    title="Interactive live browser"
                    src={liveState.currentUrl}
                    sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
                    className="w-full h-[60vh] min-h-[28rem] border-0 bg-white"
                    style={{ objectFit: "contain" }}
                  />

                  <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-white/80 px-2 py-1 text-xs text-zinc-700">
                    Interactive embed — may be blocked by the target site
                  </div>
                </div>
              </div>
            </div>
          ) : liveState.frameDataUrl ? (
            <div className="flex justify-center bg-white">
              <div
                className={cn(
                  "w-full overflow-auto bg-white",
                  isWorkspaceVariant
                    ? "max-h-[calc(100vh-19rem)] max-w-[72rem]"
                    : "max-h-[38rem]"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={frameImageRef}
                  src={liveState.frameDataUrl}
                  alt="Live browser stream"
                  onClick={(event) => {
                    if (allowManualControl) {
                      void handleFrameClick(event);
                    }
                  }}
                  className={cn(
                    "w-full bg-white object-contain object-top",
                    manualControlsDisabled ? "cursor-default" : "cursor-pointer"
                  )}
                />
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.14),transparent_46%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.14),transparent_42%),linear-gradient(180deg,#ffffff,#f3f4f6)] px-6 text-center text-sm text-zinc-700",
                isWorkspaceVariant ? "min-h-[calc(100vh-27rem)]" : "min-h-[28rem]"
              )}
            >
              <p className="max-w-md">
                {sessionUnavailable
                  ? "This live browser session is no longer available, likely because the server restarted or the session expired. Start a new browser task to reopen it."
                  : sessionId
                    ? "Connecting to the live browser stream."
                    : "The browser task finished without capturing a screenshot."}
              </p>
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
                {sessionUnavailable
                  ? "Session ended"
                  : streamState === "connecting"
                    ? "Connecting"
                    : "No screenshot available"}
              </div>
            </div>
          )}

          {allowManualControl ? (
            <div className="border-t border-zinc-200/80 bg-zinc-50 px-4 py-3">
              <div className="flex flex-col gap-2 lg:flex-row">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                  <Input
                    value={focusedTextInput}
                    onChange={(event) => setFocusedTextInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleFocusedType();
                      }
                    }}
                    disabled={controlsDisabled}
                    placeholder="Type into the focused field"
                    className="h-8 border-0 bg-transparent px-0 py-0 text-sm text-zinc-900 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleFocusedType()}
                    disabled={controlsDisabled || !focusedTextInput.trim()}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Type
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendBrowserCommands([{ action: "press", target: "Enter" }])}
                    disabled={controlsDisabled}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Enter
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendBrowserCommands([{ action: "scroll", value: -700 }])}
                    disabled={controlsDisabled}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    Scroll up
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendBrowserCommands([{ action: "scroll", value: 700 }])}
                    disabled={controlsDisabled}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    Scroll down
                  </button>
                </div>
              </div>

              {commandError ? (
                <p className="mt-2 text-xs text-rose-600">{commandError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#13151a] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Actions
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {activityLines.length > 0 ? (
            activityLines.slice(0, 8).map((line, index) => (
              <div
                key={`${line}-${index}`}
                className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-zinc-200"
              >
                {line}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-400">
              Waiting for browser activity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
