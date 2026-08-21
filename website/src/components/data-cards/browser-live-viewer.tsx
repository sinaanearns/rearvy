"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  StopCircle,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getIdToken } from "@/lib/firebase/auth";
import {
  extractFirstOpenableBrowserUrl,
  normalizeOpenableBrowserUrl,
} from "@/lib/browser-use/openable-url";
import {
  hasScreenshotDataUrl,
  normalizeScreenshotDataUrl,
} from "@/lib/chat/screenshot-data-url";


type BrowserActionLogEntry = {
  id: string;
  action: string;
  status: string;
  message: string;
  timestamp: string;
};

type BrowserSessionFile = {
  id: string;
  filename: string;
  type: "download" | "upload" | "screenshot" | "evidence";
  contentType: string | null;
  size: number | null;
  downloadUrl: string | null;
  storagePath: string;
  browserbaseDownloadId: string | null;
  createdAt: string;
};

type BrowserSessionPayload = {
  id: string;
  task: string;
  createdAt: number;
  connectionMethod?: "cdp-direct" | "extension-relay" | "managed-runner" | "cloud-browser" | "firecrawl";
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
  screenshotDataUrl?: string | null;
  screenshotUrl?: string | null;
  liveViewUrl?: string | null;
  interactiveLiveViewUrl?: string | null;
  files?: BrowserSessionFile[];
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

type DriveStep = {
  id: string;
  step: number;
  type: "step_start" | "step_done" | "approval_required" | "done" | "error" | "progress";
  action?: string;
  reasoning?: string;
  code?: string;
  result?: string;
  error?: string;
  url?: string;
  title?: string;
  confidence?: number;
  requiresApproval?: boolean;
  approvalId?: string;
  approvalReason?: string;
  isDone?: boolean;
  summary?: string;
  status: "running" | "completed" | "failed" | "approval_required";
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
  return extractFirstOpenableBrowserUrl(...values);
}

async function readErrorMessage(res: Response, fallback: string) {
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  return payload?.error || payload?.message || fallback;
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadTextFile(text: string, fileName: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    downloadDataUrl(url, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatBytes(value: number | null | undefined) {
  if (!value || value < 1) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function buildBrowserSessionReport(session: BrowserSessionPayload) {
  const logs = [...(session.stdout || []), ...(session.stderr || [])];
  const actions = session.actionLog || [];
  const evidenceActions = actions.filter((entry) =>
    ["evidence", "screenshot", "scan_page"].includes(entry.action)
  );
  const lines = [
    `Browser session: ${session.id}`,
    `Status: ${session.status || (session.isRunning ? "running" : "closed")}`,
    session.title ? `Title: ${session.title}` : "",
    session.currentUrl ? `URL: ${session.currentUrl}` : "",
    session.task ? `Task: ${session.task}` : "",
    session.summary ? `Summary: ${session.summary}` : "",
    session.setupError ? `Setup error: ${session.setupError}` : "",
    hasScreenshotDataUrl(session.screenshotDataUrl)
      ? "Screenshot: captured"
      : "Screenshot: not captured",
    "",
    evidenceActions.length > 0 ? "Evidence:" : "",
    ...formatEvidenceLines(evidenceActions),
    "",
    "Recent actions:",
    ...actions.slice(-12).map((entry, index) =>
      `${index + 1}. [${entry.status}] ${entry.action}: ${entry.message}`
    ),
    "",
    "Logs:",
    ...logs.slice(-40),
  ].filter((line) => line !== "");

  return lines.join("\n");
}

function formatEvidenceLines(evidenceActions: BrowserActionLogEntry[]) {
  return evidenceActions
    .slice(-8)
    .map((entry, index) => `${index + 1}. [${entry.status}] ${entry.action}: ${entry.message}`);
}

function buildBrowserEvidenceReport(session: BrowserSessionPayload) {
  const evidenceActions = (session.actionLog || []).filter((entry) =>
    ["evidence", "screenshot", "scan_page"].includes(entry.action)
  );
  const lines = [
    `Browser evidence: ${session.id}`,
    session.title ? `Title: ${session.title}` : "",
    session.currentUrl ? `URL: ${session.currentUrl}` : "",
    session.task ? `Task: ${session.task}` : "",
    session.summary ? `Summary: ${session.summary}` : "",
    session.setupError ? `Setup error: ${session.setupError}` : "",
    hasScreenshotDataUrl(session.screenshotDataUrl)
      ? "Screenshot: captured"
      : "Screenshot: not captured",
    "",
    evidenceActions.length > 0 ? "Evidence actions:" : "No dedicated evidence actions yet.",
    ...formatEvidenceLines(evidenceActions),
  ].filter((line) => line !== "");

  return lines.join("\n");
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
  const [syncingFiles, setSyncingFiles] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [driveSteps, setDriveSteps] = useState<DriveStep[]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveDone, setDriveDone] = useState(false);
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());
  const [showDrivePanel, setShowDrivePanel] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const driveScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const driveEventSourceRef = useRef<EventSource | null>(null);
  const driveStepCounterRef = useRef(0);

  const fetchWithAuth = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Sign in to view this browser session.");
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
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
  }, [fetchSession]);

  useEffect(() => {
    if (!session?.isRunning) return;
    const timer = setInterval(() => {
      void fetchSession();
    }, 1500);
    return () => clearInterval(timer);
  }, [fetchSession, session?.isRunning]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.stdout, session?.stderr, session?.actionLog]);

  useEffect(() => {
    if (driveScrollRef.current) {
      driveScrollRef.current.scrollTop = driveScrollRef.current.scrollHeight;
    }
  }, [driveSteps]);

  // Connect to the SSE drive stream when session is running and has drive steps
  // This subscribes to /api/browser/sessions/:id/drive and receives step-by-step AI updates.
  const startDriveStream = useCallback(
    async (goal: string, resumeApprovalId?: string) => {
      // Close any existing stream
      driveEventSourceRef.current?.close();
      driveEventSourceRef.current = null;

      const token = await getIdToken();
      if (!token) return;

      // We use fetch+ReadableStream for SSE since EventSource doesn't support POST with auth headers
      try {
        const response = await fetch(`/api/browser/sessions/${sessionId}/drive`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            goal,
            maxSteps: 15,
            ...(resumeApprovalId ? { resumeApprovalId } : {}),
          }),
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const processStream = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(line.slice(6)) as DriveStep & {
                  type: string;
                  ok?: boolean;
                  summary?: string;
                  error?: string;
                };

                driveStepCounterRef.current += 1;
                const stepId = `drive_${driveStepCounterRef.current}`;

                if (event.type === "step_start") {
                  setDriveSteps((prev) => [
                    ...prev,
                    {
                      id: stepId,
                      step: event.step ?? driveStepCounterRef.current,
                      type: "step_start",
                      action: event.action,
                      reasoning: event.reasoning,
                      code: event.code,
                      confidence: event.confidence,
                      requiresApproval: event.requiresApproval,
                      status: "running",
                    },
                  ]);
                  // Notify ChatContainer that a drive step is running
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("rearvy:browser-drive-step", {
                        detail: {
                          status: "running",
                          action: event.action ?? "Working on browser",
                          step: event.step ?? driveStepCounterRef.current,
                          sessionId,
                        },
                      })
                    );
                  }
                } else if (event.type === "step_done") {
                  setDriveSteps((prev) =>
                    prev.map((s) =>
                      s.step === event.step && s.type === "step_start"
                        ? { ...s, type: "step_done", result: event.result, status: "completed" }
                        : s
                    )
                  );
                  // Refresh session to pick up URL/title changes
                  void fetchSession();
                } else if (event.type === "progress") {
                  // Silent scan step — just refresh session
                  void fetchSession();
                } else if (event.type === "approval_required") {
                  setDriveSteps((prev) => [
                    ...prev,
                    {
                      id: stepId,
                      step: event.step ?? driveStepCounterRef.current,
                      type: "approval_required",
                      action: event.action,
                      reasoning: event.reasoning,
                      code: event.code,
                      requiresApproval: true,
                      approvalId: event.approvalId,
                      approvalReason: event.approvalReason,
                      status: "approval_required",
                    },
                  ]);
                  // Notify ChatContainer that approval is needed (drive is paused)
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("rearvy:browser-drive-step", {
                        detail: {
                          status: "approval_required",
                          action: event.approvalReason ?? "Approval required",
                          step: event.step ?? driveStepCounterRef.current,
                          sessionId,
                        },
                      })
                    );
                  }
                  void fetchSession();
                } else if (event.type === "done") {
                  setDriveSteps((prev) => [
                    ...prev,
                    {
                      id: stepId,
                      step: (event.step ?? driveStepCounterRef.current) + 1,
                      type: "done",
                      summary: event.summary,
                      isDone: true,
                      status: "completed",
                    },
                  ]);
                  setDriveDone(true);
                  // Notify ChatContainer that drive loop is finished
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("rearvy:browser-drive-step", {
                        detail: { status: "done", sessionId },
                      })
                    );
                  }
                  void fetchSession();
                } else if (event.type === "error") {
                  setDriveError(event.error ?? "Unknown error");
                  // Notify ChatContainer that drive loop errored
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("rearvy:browser-drive-step", {
                        detail: { status: "done", sessionId },
                      })
                    );
                  }
                  void fetchSession();
                }
              } catch {
                // malformed SSE line — ignore
              }
            }
          }
        };

        processStream().catch(() => {});
      } catch {
        // stream failed — non-fatal
      }
    },
    [sessionId, fetchSession]
  );

  const handleApproveAction = useCallback(
    async (approvalId: string) => {
      if (!session?.task) return;
      await startDriveStream(session.task, approvalId);
    },
    [session, startDriveStream]
  );

  const toggleStepExpanded = useCallback((stepId: string) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

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

  const handleDownloadScreenshot = () => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    const dataUrl = normalizeScreenshotDataUrl(currentSession.screenshotDataUrl);
    if (!dataUrl) {
      toast.error("No browser screenshot is available.");
      return;
    }

    downloadDataUrl(dataUrl, `rearvy-browser-${currentSession.id}-screenshot.png`);
    toast.success("Browser screenshot downloaded.");
  };

  const handleCopyReport = async () => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildBrowserSessionReport(currentSession));
      toast.success("Browser report copied.");
    } catch {
      toast.error("Failed to copy browser report.");
    }
  };

  const handleCopyEvidence = async () => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildBrowserEvidenceReport(currentSession));
      toast.success("Browser evidence copied.");
    } catch {
      toast.error("Failed to copy browser evidence.");
    }
  };

  const handleCopyUrl = async () => {
    const currentUrl = session?.currentUrl || firstUrl(session?.task, session?.summary);
    if (!currentUrl) {
      toast.error("No browser URL is available.");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
      toast.success("Browser URL copied.");
    } catch {
      toast.error("Failed to copy browser URL.");
    }
  };

  const handleOpenUrl = () => {
    const currentUrl =
      normalizeOpenableBrowserUrl(session?.currentUrl) ||
      firstUrl(session?.task, session?.summary);
    if (!currentUrl) {
      toast.error("No browser URL is available.");
      return;
    }

    window.open(currentUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyText = async (value: string, label: string) => {
    if (!value.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const handleDownloadReport = () => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    downloadTextFile(
      buildBrowserSessionReport(currentSession),
      `rearvy-browser-${currentSession.id}-report.txt`
    );
    toast.success("Browser report downloaded.");
  };

  const handleDownloadEvidence = () => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    downloadTextFile(
      buildBrowserEvidenceReport(currentSession),
      `rearvy-browser-${currentSession.id}-evidence.txt`
    );
    toast.success("Browser evidence downloaded.");
  };

  const handleSyncFiles = async () => {
    const currentSession = session;
    if (!currentSession || currentSession.connectionMethod !== "cloud-browser" || syncingFiles) {
      return;
    }

    setSyncingFiles(true);
    try {
      const res = await fetchWithAuth(
        `/api/cloud-computer/sessions/${currentSession.id}/files/sync`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to sync files"));
      }

      const payload = (await res.json()) as {
        session?: BrowserSessionPayload;
        syncedFiles?: BrowserSessionFile[];
        message?: string;
      };
      if (payload.session) {
        setSession(payload.session);
      } else {
        await fetchSession();
      }
      toast.success(payload.message || "Cloud computer files synced.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync cloud files.");
    } finally {
      setSyncingFiles(false);
    }
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const currentSession = session;
    if (!file || !currentSession || currentSession.connectionMethod !== "cloud-browser") {
      return;
    }

    setUploadingFile(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetchWithAuth(
        `/api/cloud-computer/sessions/${currentSession.id}/files/upload`,
        {
          method: "POST",
          body: form,
        }
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to upload file"));
      }

      const payload = (await res.json()) as {
        session?: BrowserSessionPayload;
        message?: string;
      };
      if (payload.session) {
        setSession(payload.session);
      } else {
        await fetchSession();
      }
      toast.success(payload.message || "File uploaded to cloud browser.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setUploadingFile(false);
    }
  };

  if (loading && !session) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          <p className="text-xs">Connecting to browser stream...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-background p-6 text-center text-red-500">
        <p className="text-sm">{error}</p>
        <Button onClick={fetchSession} className="mt-4" variant="outline" size="sm">
          Retry
        </Button>
      </div>
    );
  }

  const isElectron =
    typeof window !== "undefined" &&
    (Boolean((window as unknown as { electron?: unknown }).electron) ||
      navigator.userAgent.includes("Electron"));
  const displayUrl = session?.currentUrl || firstUrl(session?.task, session?.summary);
  const openableUrl =
    normalizeOpenableBrowserUrl(session?.currentUrl) ||
    firstUrl(session?.task, session?.summary);
  const liveViewUrl =
    session?.interactiveLiveViewUrl ||
    session?.liveViewUrl ||
    normalizeOpenableBrowserUrl(session?.interactiveLiveViewUrl) ||
    normalizeOpenableBrowserUrl(session?.liveViewUrl);
  const screenshotDataUrl = normalizeScreenshotDataUrl(session?.screenshotDataUrl);
  const hasScreenshot = hasScreenshotDataUrl(screenshotDataUrl);
  const hasLiveView = Boolean(liveViewUrl);

  const status = session?.status || (session?.isRunning ? "running" : "closed");
  const needsApproval = status === "awaiting_approval" || Boolean(session?.awaitingApproval);
  const setupError = session?.setupError;
  const canSendCommand = allowManualControl && Boolean(session?.isRunning) && !sending;

  // Pending drive approval step
  const pendingApprovalStep = driveSteps.find((s) => s.type === "approval_required" && s.status === "approval_required");

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {setupError && (
        <div className="absolute top-0 inset-x-0 z-20 border-b border-red-500/20 bg-red-950/90 p-3 pl-24 text-xs text-red-200 backdrop-blur-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="font-medium text-red-100">Browser runtime setup failed</div>
              <div className="mt-1 break-words">{setupError}</div>
            </div>
          </div>
        </div>
      )}

      {/* Drive approval banner — shown when AI drive needs user approval for a sensitive action */}
      {pendingApprovalStep && (
        <div className="absolute top-0 inset-x-0 z-20 border-b border-amber-500/20 bg-amber-950/90 p-3 pl-24 text-xs text-amber-100 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="truncate">
                {pendingApprovalStep.approvalReason || `Rearvy wants to execute: ${pendingApprovalStep.action}`}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => pendingApprovalStep.approvalId && handleApproveAction(pendingApprovalStep.approvalId)}
                className="h-7 bg-amber-500 px-3 text-xs font-medium text-black hover:bg-amber-400"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDriveSteps((prev) =>
                    prev.map((s) =>
                      s.id === pendingApprovalStep.id ? { ...s, status: "failed" } : s
                    )
                  )
                }
                className="h-7 px-3 text-xs"
              >
                Deny
              </Button>
            </div>
          </div>
          {pendingApprovalStep.code && (
            <div className="mt-2 rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-amber-200/70 whitespace-pre-wrap">
              {pendingApprovalStep.code.slice(0, 300)}
            </div>
          )}
        </div>
      )}

      {!pendingApprovalStep && needsApproval && (
        <div className="absolute top-0 inset-x-0 z-20 border-b border-amber-500/20 bg-amber-950/90 p-3 pl-24 text-xs text-amber-100 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="truncate">
                {session?.awaitingApproval?.reason || "Approval required for browser action."}
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={!canSendCommand}
              className="h-7 shrink-0 bg-amber-500 px-3 text-xs font-medium text-black hover:bg-amber-400"
            >
              Approve
            </Button>
          </div>
        </div>
      )}

      {/* Floating stop button — shown when a live session is running */}
      {session?.isRunning && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
          <button
            onClick={handleStop}
            title="Stop browser session"
            className="group flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/80 px-3 py-1.5 text-xs font-medium text-red-300 shadow-lg backdrop-blur-md transition-all hover:border-red-400 hover:bg-red-900 hover:text-red-100 active:scale-95"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <StopCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Main browser display — live view iframe, screenshot, or fallback */}
      <div className="relative flex-1 overflow-hidden">
        {hasLiveView ? (
          isElectron ? (
            <webview
              src={liveViewUrl!}
              className="h-full w-full border-none bg-white"
              title="Cloud browser live view"
            />
          ) : (
            <iframe
              src={liveViewUrl!}
              className="h-full w-full border-none bg-white"
              title="Cloud browser live view"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write; fullscreen; camera; microphone"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            />
          )
        ) : hasScreenshot ? (
          <div className="relative flex h-full w-full flex-col bg-slate-950">
            <div className="flex h-full w-full items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshotDataUrl!}
                alt={session?.title || "Browser screenshot"}
                className="max-h-full max-w-full rounded object-contain shadow-2xl"
              />
            </div>
          </div>
        ) : isElectron && openableUrl ? (
          <webview
            src={openableUrl}
            className="h-full w-full border-none bg-white"
            title="Browser view"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
            <p className="mt-3">Preparing live browser stream...</p>
          </div>
        )}
      </div>

      {/* AI Drive Steps Panel — shows Rearvy's step-by-step reasoning and actions */}
      {driveSteps.length > 0 && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm flex-shrink-0" style={{ maxHeight: "240px" }}>
          {/* Panel header */}
          <button
            onClick={() => setShowDrivePanel((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-sky-400 font-semibold">Rearvy AI Drive</span>
              <span className="text-muted-foreground/60">
                {driveSteps.filter((s) => s.type === "step_done" || s.type === "done").length} /{" "}
                {driveSteps.filter((s) => s.type !== "progress").length} steps
              </span>
              {driveDone && (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Done
                </span>
              )}
              {driveError && (
                <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                  Error
                </span>
              )}
            </div>
            {showDrivePanel ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {showDrivePanel && (
            <div
              ref={driveScrollRef}
              className="overflow-y-auto px-3 pb-2 space-y-1"
              style={{ maxHeight: "200px" }}
            >
              {driveSteps
                .filter((s) => s.type !== "progress")
                .map((step) => {
                  const isExpanded = expandedStepIds.has(step.id);
                  const statusColor =
                    step.status === "completed"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : step.status === "running"
                        ? "text-sky-400 bg-sky-500/10"
                        : step.status === "approval_required"
                          ? "text-amber-400 bg-amber-500/10"
                          : "text-red-400 bg-red-500/10";

                  return (
                    <div key={step.id} className="rounded border border-border/30 bg-muted/20 overflow-hidden">
                      {/* Step header */}
                      <button
                        onClick={() => toggleStepExpanded(step.id)}
                        className="flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className={cn("mt-0.5 flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide", statusColor)}>
                          {step.status === "running"
                            ? "↻"
                            : step.status === "completed"
                              ? "✓"
                              : step.status === "approval_required"
                                ? "⚠"
                                : "✗"}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {step.type === "done" ? (
                              <span className="text-[11px] font-semibold text-emerald-400 truncate">
                                {step.summary || "Goal achieved"}
                              </span>
                            ) : step.type === "approval_required" ? (
                              <span className="text-[11px] font-semibold text-amber-400 truncate">
                                Approval required: {step.action}
                              </span>
                            ) : (
                              <>
                                <span className="text-[11px] font-medium text-foreground/80 truncate">
                                  {step.action?.replace(/_/g, " ") || `Step ${step.step}`}
                                </span>
                                {step.status === "running" && (
                                  <Loader2 className="h-3 w-3 animate-spin text-sky-400 flex-shrink-0" />
                                )}
                              </>
                            )}
                          </div>
                          {step.reasoning && (
                            <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                              {step.reasoning}
                            </p>
                          )}
                        </div>

                        {(step.code || step.result) && (
                          <span className="text-muted-foreground/40 mt-0.5 flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </button>

                      {/* Expanded code + result */}
                      {isExpanded && (
                        <div className="border-t border-border/20 bg-black/30 px-2 py-2 space-y-1.5">
                          {step.code && (
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Code2 className="h-3 w-3 text-muted-foreground/50" />
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Code</span>
                              </div>
                              <pre className="text-[10px] text-sky-300/80 whitespace-pre-wrap break-all font-mono">
                                {step.code.slice(0, 500)}
                              </pre>
                            </div>
                          )}
                          {step.result && (
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Zap className="h-3 w-3 text-muted-foreground/50" />
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Result</span>
                              </div>
                              <pre className="text-[10px] text-emerald-300/80 whitespace-pre-wrap break-all font-mono">
                                {step.result.slice(0, 400)}
                              </pre>
                            </div>
                          )}
                          {step.error && (
                            <pre className="text-[10px] text-red-300/80 whitespace-pre-wrap break-all font-mono">
                              {step.error}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {driveError && (
                <div className="rounded border border-red-500/20 bg-red-950/30 px-2 py-1.5 text-[11px] text-red-300">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {driveError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
