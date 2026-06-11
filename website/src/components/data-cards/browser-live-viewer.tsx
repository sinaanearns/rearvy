"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  StopCircle,
  Terminal,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getIdToken } from "@/lib/firebase/auth";
import {
  extractFirstOpenableBrowserUrl,
  normalizeOpenableBrowserUrl,
} from "@/lib/browser-use/openable-url";

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
  connectionMethod?: "cdp-direct" | "extension-relay" | "managed-runner" | "cloud-browser";
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
    session.screenshotDataUrl?.startsWith("data:image/")
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
    session.screenshotDataUrl?.startsWith("data:image/")
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDownloadScreenshot = () => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    const dataUrl = currentSession.screenshotDataUrl;
    if (!dataUrl?.startsWith("data:image/")) {
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
  const isCloudSession = session?.connectionMethod === "cloud-browser";
  const displayUrl = session?.currentUrl || firstUrl(session?.task, session?.summary);
  const openableUrl =
    normalizeOpenableBrowserUrl(session?.currentUrl) ||
    firstUrl(session?.task, session?.summary);
  const liveViewUrl = normalizeOpenableBrowserUrl(session?.liveViewUrl);
  const browserFrameUrl = isCloudSession ? liveViewUrl : openableUrl;
  const files = session?.files || [];
  const actions = session?.actionLog || [];
  const status = session?.status || (session?.isRunning ? "running" : "closed");
  const needsApproval = status === "awaiting_approval" || Boolean(session?.awaitingApproval);
  const setupError = session?.setupError;
  const canSendCommand = allowManualControl && Boolean(session?.isRunning) && !sending;

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-[8px] border-border/70 bg-card/90 py-0 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="h-1 bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300" />
      <CardHeader className="border-b border-border/60 bg-background/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-sky-200/30 bg-sky-200/10 text-sky-600 dark:text-sky-200">
                <Globe className="h-4 w-4" />
              </span>
              <CardTitle className="truncate text-sm font-semibold tracking-tight">
                {session?.title || "Live Browser Session"}
              </CardTitle>
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {displayUrl || "Waiting for browser URL"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-medium", statusTone(status, session?.isRunning))}>
              {needsApproval ? <ShieldAlert className="h-3 w-3" /> : session?.isRunning ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {statusLabel(status, session?.isRunning)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyUrl}
              disabled={!displayUrl && !openableUrl}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Copy browser URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenUrl}
              disabled={!openableUrl}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Open browser URL"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyReport}
              disabled={!session}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Copy browser report"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyEvidence}
              disabled={!session}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Copy browser evidence"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownloadEvidence}
              disabled={!session}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Download browser evidence"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownloadReport}
              disabled={!session}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Download browser report"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            {isCloudSession ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSyncFiles}
                disabled={!session || syncingFiles}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Sync cloud files"
              >
                {syncingFiles ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>
            ) : null}
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

        {(browserFrameUrl || displayUrl) && (
          <div className="flex min-h-[42%] flex-1 flex-col border-b border-border/50">
            <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-1.5 font-mono text-xs text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {isCloudSession ? displayUrl || "Browserbase Live View" : displayUrl}
              </span>
              {isCloudSession ? (
                <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-normal text-sky-600 dark:text-sky-300">
                  live view
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopyUrl}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                title="Copy browser URL"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleOpenUrl}
                disabled={!openableUrl}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                title="Open browser URL"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            {isCloudSession ? (
              browserFrameUrl ? (
                <iframe
                  src={browserFrameUrl}
                  className="w-full flex-1 border-none bg-white"
                  title="Cloud browser live view"
                  referrerPolicy="no-referrer"
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              ) : (
                <div className="flex flex-1 items-center justify-center bg-background/70 p-6 text-center text-sm text-muted-foreground">
                  Live View is being prepared. Refresh the session if it does not appear.
                </div>
              )
            ) : browserFrameUrl ? (
              <webview
                src={browserFrameUrl}
                className="w-full flex-1 border-none bg-white"
                title="Browser preview"
              />
            ) : null}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr]">
          {session?.task ? (
            <div className="border-b border-border/50 bg-muted/20 px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground">
                <span>Task brief</span>
                {session.connectionMethod ? (
                  <span className="rounded bg-background px-1.5 py-0.5 font-mono normal-case">
                    {session.connectionMethod}
                  </span>
                ) : null}
                {session.screenshotDataUrl?.startsWith("data:image/") ? (
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-300">
                    screenshot captured
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-3 break-words text-muted-foreground">
                {session.task}
              </p>
            </div>
          ) : null}

          {session?.summary && (
            <div className="border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Latest result: </span>
              {session.summary}
            </div>
          )}

          {isCloudSession ? (
            <div className="border-b border-border/50 bg-background/60 px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-foreground">Files and artifacts</div>
                  <div className="mt-0.5 text-muted-foreground">
                    Downloads, screenshots, and synced evidence from this cloud browser.
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => void handleUploadFile(event)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    {uploadingFile ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Upload
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleSyncFiles}
                    disabled={syncingFiles}
                  >
                    {syncingFiles ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Sync files
                  </Button>
                </div>
              </div>

              {files.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {files.slice(0, 6).map((file) => {
                    const downloadUrl = normalizeOpenableBrowserUrl(file.downloadUrl);

                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-[8px] border border-border/60 bg-muted/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {file.filename}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{file.type}</span>
                            {file.contentType ? <span>{file.contentType}</span> : null}
                            {formatBytes(file.size) ? <span>{formatBytes(file.size)}</span> : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          disabled={!downloadUrl}
                          onClick={() => {
                            if (downloadUrl) {
                              window.open(downloadUrl, "_blank", "noopener,noreferrer");
                            }
                          }}
                          title="Open artifact"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-[8px] border border-dashed border-border/70 px-3 py-2 text-muted-foreground">
                  No synced files yet.
                </div>
              )}
            </div>
          ) : null}

          {session?.screenshotDataUrl?.startsWith("data:image/") ? (
            <div className="border-b border-border/50 bg-background/60 px-4 py-3">
              <div className="overflow-hidden rounded-[8px] border border-border/60 bg-background">
                <div className="flex justify-end border-b border-border/50 px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleDownloadScreenshot}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download screenshot
                  </Button>
                </div>
                <Image
                  src={session.screenshotDataUrl}
                  alt="Browser screenshot evidence"
                  width={960}
                  height={540}
                  unoptimized
                  className="max-h-72 w-full object-contain"
                />
                <div className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
                  Latest screenshot captured by Maria's browser session.
                </div>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 overflow-y-auto p-4 font-mono text-xs" ref={scrollRef}>
            {actions.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="font-sans text-[11px] font-medium uppercase text-muted-foreground">
                  Recent actions
                </div>
                {actions.slice(-8).map((entry) => {
                  const actionText = `[${entry.status}] ${entry.action}\n${entry.message}`;
                  const isEvidence =
                    entry.action === "evidence" ||
                    entry.action === "screenshot" ||
                    entry.action === "scan_page";
                  return (
                  <div
                    key={entry.id}
                    className={cn(
                      "group/action relative rounded-[8px] border px-2 py-1.5 pr-9",
                      isEvidence
                        ? "border-sky-500/30 bg-sky-500/10"
                        : "border-border/50 bg-muted/20"
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-6 w-6 rounded-[8px] opacity-0 group-hover/action:opacity-100"
                      onClick={() => void handleCopyText(actionText, "Browser action")}
                      aria-label="Copy browser action"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{isEvidence ? `evidence - ${entry.action}` : entry.action}</span>
                      <span>{statusLabel(entry.status)}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-foreground/80">
                      {entry.message}
                    </div>
                  </div>
                  );
                })}
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
                      "group/log relative break-words pr-8",
                      log.startsWith("__EXIT_CODE__")
                        ? "text-slate-500 italic"
                        : log.toLowerCase().includes("error")
                          ? "text-red-300"
                          : "text-slate-300"
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-6 w-6 rounded-[8px] opacity-0 group-hover/log:opacity-100"
                      onClick={() => void handleCopyText(log, "Browser log")}
                      aria-label="Copy browser log"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
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
                  className="w-full rounded-[8px] border border-border/50 bg-background/50 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
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
