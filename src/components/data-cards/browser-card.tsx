"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dispatchBrowserAutomationReply } from "@/lib/browser-use/events";
import { getIdToken } from "@/lib/firebase/auth";
import { MEMORY_UPDATED_EVENT } from "@/lib/memory-events";
import { sanitizeAssistantText } from "@/lib/ai/sanitize";
import { BrowserLiveViewer } from "./browser-live-viewer";
import { BrowserWebViewer } from "./browser-web-viewer";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  KeyRound,
  Layout,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

type BrowserCredentialSummary = {
  label?: string;
  service?: string;
  loginMask?: string;
  lastUsedAt?: string | null;
};

type BrowserSessionSnapshot = {
  ok: boolean;
  sessionId: string;
  task: string;
  createdAt: number;
  pid: number | null;
  status: string;
  stdout: string[];
  stderr: string[];
  lastOutput: string | null;
  summary: string;
};

interface BrowserCardProps {
  data: Record<string, unknown>;
  showViewer?: boolean;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const uniqueItems = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const normalizedItem = item.trim();
    if (!normalizedItem) {
      continue;
    }

    uniqueItems.add(normalizedItem);
  }

  return Array.from(uniqueItems);
}

function asCredentialArray(value: unknown): BrowserCredentialSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is BrowserCredentialSummary =>
      Boolean(item) && typeof item === "object"
  );
}

function getStatusTone(status: string | null) {
  switch (status) {
    case "completed":
      return {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        label: "Completed",
        className: "text-emerald-600",
      };
    case "ready":
    case "running":
      return {
        icon: <Globe className="h-4 w-4 text-sky-500" />,
        label: status === "running" ? "Running" : "Ready",
        className: "text-sky-600",
      };
    case "needs_input":
    case "blocked":
      return {
        icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
        label: status === "blocked" ? "Blocked" : "Needs input",
        className: "text-amber-600",
      };
    case "failed":
    case "unavailable":
      return {
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        label: status === "unavailable" ? "Unavailable" : "Failed",
        className: "text-red-600",
      };
    default:
      return {
        icon: <Globe className="h-4 w-4 text-sky-500" />,
        label: "Browser",
        className: "text-sky-600",
      };
  }
}

function emitMemoryUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
}

export function BrowserCard({ data, showViewer = true }: BrowserCardProps) {
  const { user } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const status =
    typeof data.status === "string" ? data.status.toLowerCase() : null;
  const tone = getStatusTone(status);
  const summary =
    typeof data.summary === "string"
      ? sanitizeAssistantText(data.summary)
      : typeof data.message === "string"
        ? sanitizeAssistantText(data.message)
        : "Browser workflow update";
  const service =
    typeof data.service === "string" && data.service.trim()
      ? data.service
      : "website";
  const blocker =
    typeof data.blocker === "string" && data.blocker.trim()
      ? data.blocker
      : null;
  const task =
    typeof data.task === "string" && data.task.trim() ? data.task : null;
  const demoMode = data.demoMode === true;
  const followUpQuestions = asStringArray(data.followUpQuestions);
  const notes = asStringArray(data.notes);
  const errors = asStringArray(data.errors);
  const createdEntities = asStringArray(data.createdEntities);
  const suggestedReplies = asStringArray(data.suggestedReplies);
  const availableCredentials = asCredentialArray(data.availableCredentials);
  const requiresCredentialInput = data.requiresCredentialInput === true;
  const credentialInput =
    data.credentialInput && typeof data.credentialInput === "object"
      ? (data.credentialInput as Record<string, unknown>)
      : null;
  const defaultLabelSuggestion =
    credentialInput && typeof credentialInput.labelSuggestion === "string"
      ? credentialInput.labelSuggestion
      : `${service} login`;
  const activityLines = [
    task ? `Task: ${task}` : null,
    summary,
    ...notes.slice(0, 3).map((note) => `Note: ${note}`),
    blocker ? `Blocker: ${blocker}` : null,
  ].filter(Boolean) as string[];

  const [label, setLabel] = useState(defaultLabelSuggestion);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionSnapshot, setSessionSnapshot] = useState<BrowserSessionSnapshot | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const handleQuickReply = (prompt: string) => {
    dispatchBrowserAutomationReply(prompt);
  };

  useEffect(() => {
    if (!sessionId) {
      setSessionSnapshot(null);
      return;
    }

    let active = true;

    const refreshSessionSnapshot = async () => {
      try {
        const response = await fetch(`/api/browser/session/${sessionId}/command`, {
          method: "GET",
        });
        const payload = (await response.json()) as Partial<BrowserSessionSnapshot> & {
          error?: string;
        };

        if (!active) {
          return;
        }

        if (!response.ok || payload.ok !== true) {
          setSessionSnapshot(null);
          return;
        }

        setSessionSnapshot(payload as BrowserSessionSnapshot);
      } catch {
        if (active) {
          setSessionSnapshot(null);
        }
      }
    };

    refreshSessionSnapshot();
    const interval = window.setInterval(refreshSessionSnapshot, 2000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [sessionId]);

  const handleSaveCredential = async () => {
    if (!user) {
      toast.error("Sign in first to store a browser credential.");
      return;
    }

    if (!label.trim() || !login.trim() || !password.trim()) {
      toast.error("Add a label, login, and password first.");
      return;
    }

    setIsSavingCredential(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/browser/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label: label.trim(),
          service,
          login: login.trim(),
          password,
          remember,
        }),
      });

      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Failed to store browser credential."
        );
      }

      setPassword("");
      toast.success(
        remember
          ? "Credential saved securely and added to memory."
          : "Credential saved securely for this browser workflow."
      );

      if (remember) {
        emitMemoryUpdated();
      }

      const suggestedPrompt =
        typeof payload.suggestedPrompt === "string"
          ? payload.suggestedPrompt
          : task
            ? `Continue the browser task "${task}" using saved browser credential label "${label.trim()}".`
            : `Continue the browser task using saved browser credential label "${label.trim()}".`;

      dispatchBrowserAutomationReply(suggestedPrompt);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to store browser credential."
      );
    } finally {
      setIsSavingCredential(false);
    }
  };

  const startLiveSession = async () => {
    if (!task) {
      toast.error("No browser task available to start a live session.");
      return;
    }
    setIsStartingSession(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Sign in first to start a live browser session.");
      }

      const payload = await (
        await fetch("/api/browser/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ task }),
        })
      ).json();
      if (!payload.ok) throw new Error(payload.error || "failed_to_start_session");
      setSessionId(payload.sessionId);
      toast.success("Live browser session started.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsStartingSession(false);
    }
  };

  const closeLiveSession = async () => {
    if (!sessionId) return;
    try {
      const payload = await (await fetch(`/api/browser/session/${sessionId}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd: "close" }) })).json();
      if (!payload.ok) throw new Error(payload.error || "failed_to_close_session");
      toast.success("Live session closed.");
      setSessionId(null);
      setSessionSnapshot(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (!isClient) {
    return (
      <Card className="w-full border-border/70 bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" />
                Browser Session
              </CardTitle>
              {task ? (
                <p className="mt-1 text-xs text-muted-foreground">{task}</p>
              ) : null}
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium ${tone.className}`}
            >
              {tone.icon}
              <span>{tone.label}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-border/70 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Browser Session
            </CardTitle>
            {task ? (
              <p className="mt-1 text-xs text-muted-foreground">{task}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium ${tone.className}`}
            >
              {tone.icon}
              <span>{tone.label}</span>
            </div>
            {isClient ? (
              sessionId ? (
                <button onClick={closeLiveSession} className="ml-2 rounded-md bg-red-600 px-2 py-1 text-xs text-white">Close Session</button>
              ) : (
                <button onClick={startLiveSession} disabled={isStartingSession} className="ml-2 rounded-md bg-sky-600 px-2 py-1 text-xs text-white">{isStartingSession ? "Starting..." : "Start Live Session"}</button>
              )
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {sessionId ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sky-950 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                  AI is controlling
                </p>
                <p className="text-sm font-medium text-foreground">
                  {sessionSnapshot?.task ?? task ?? "Live browser session"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sessionSnapshot?.summary ?? "Waiting for the browser session to report its current target."}
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-200">
                {sessionSnapshot?.status ?? "starting"}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-sky-200/70 bg-white/80 px-3 py-2 dark:border-sky-500/20 dark:bg-sky-950/30">
                <p className="text-sky-700 dark:text-sky-300">Session</p>
                <p className="mt-1 break-all font-mono text-[11px] text-foreground">
                  {sessionId}
                </p>
              </div>
              <div className="rounded-xl border border-sky-200/70 bg-white/80 px-3 py-2 dark:border-sky-500/20 dark:bg-sky-950/30">
                <p className="text-sky-700 dark:text-sky-300">Current output</p>
                <p className="mt-1 line-clamp-2 text-foreground">
                  {sessionSnapshot?.lastOutput ?? "No output yet."}
                </p>
              </div>
            </div>

            {(sessionSnapshot?.stdout.length || sessionSnapshot?.stderr.length) ? (
              <div className="mt-3 rounded-xl border border-sky-200/70 bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-sky-100 dark:border-sky-500/20">
                <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/80">
                  Recent activity
                </p>
                <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                  {(sessionSnapshot?.stdout ?? []).slice(-3).map((line, index) => (
                    <div key={`stdout-${index}`} className="whitespace-pre-wrap break-words text-sky-100/90">
                      {line}
                    </div>
                  ))}
                  {(sessionSnapshot?.stderr ?? []).slice(-2).map((line, index) => (
                    <div key={`stderr-${index}`} className="whitespace-pre-wrap break-words text-amber-200/90">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {typeof data.currentUrl === "string" && data.currentUrl.trim() ? (
          <BrowserWebViewer
            url={data.currentUrl}
            title={typeof data.title === "string" ? data.title : task}
          />
        ) : null}

        {status !== "unavailable" && showViewer ? (
          <BrowserLiveViewer
            data={data}
            blocker={blocker}
            summary={summary}
            task={task}
            toneLabel={tone.label}
            fallbackActivityLines={activityLines}
            allowManualControl={true}
          />
        ) : status !== "unavailable" ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
            <div className="rounded-lg bg-sky-500/10 p-2">
              <Layout className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                App browser activity pinned beside chat
              </p>
              <p className="text-[10px] text-muted-foreground">
                Rearvy is controlling this session for your workflow.
              </p>
            </div>
          </div>
        ) : null}

        {demoMode ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/30 dark:bg-blue-900/10">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-1.5 dark:bg-blue-900/30">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-400">
                  Demo Mode - Browser Automation Preview
                </p>
                <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-500/90">
                  This is a demonstration of browser automation capabilities. For unlimited browser tasks with real-time control, upgrade your account at{" "}
                  <a
                    href="https://cloud.browser-use.com/settings"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline hover:text-blue-900 dark:hover:text-blue-300"
                  >
                    browser-use.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {createdEntities.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Created
            </p>
            <div className="flex flex-wrap gap-2">
              {createdEntities.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {followUpQuestions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Next questions
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {followUpQuestions.map((question, index) => (
                <li
                  key={`${question}-${index}`}
                  className="rounded-xl bg-muted/40 px-3 py-2"
                >
                  {question}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {availableCredentials.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Saved credentials
            </p>
            <div className="space-y-2">
              {availableCredentials.map((credential, index) => (
                <div
                  key={`${credential.service ?? service}-${credential.label ?? "credential"}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{credential.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {credential.loginMask ?? "stored"} • {credential.service ?? service}
                    </p>
                  </div>
                  {task ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleQuickReply(
                          `Continue the browser task "${task}" using saved browser credential label "${credential.label}".`
                        )
                      }
                    >
                      Use
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {requiresCredentialInput ? (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 text-sky-500" />
              <div>
                <p className="text-sm font-medium">Secure credential handoff</p>
                <p className="text-xs text-muted-foreground">
                  This stores the login encrypted on the server so the assistant
                  can keep working without putting passwords in normal chat.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Label
                <input
                  type="text"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="youtube login"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Login / email
                <input
                  type="text"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="you@example.com"
                  autoComplete="username"
                />
              </label>
            </div>

            <label className="block text-xs text-muted-foreground">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Enter the password securely"
                autoComplete="current-password"
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember this credential for future browser tasks and add a masked
              note to Memory
            </label>

            <Button
              type="button"
              onClick={handleSaveCredential}
              disabled={isSavingCredential}
              className="w-full sm:w-auto"
            >
              {isSavingCredential ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Save securely and continue
            </Button>
          </div>
        ) : null}

        {suggestedReplies.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Quick actions
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedReplies.map((reply, index) => (
                <Button
                  key={`${reply}-${index}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickReply(reply)}
                >
                  {reply.length > 54 ? `${reply.slice(0, 51)}...` : reply}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {notes.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Notes
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {notes.map((note, index) => (
                <li key={`${note}-${index}`}>• {note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {errors.length > 0 && status !== "unavailable" ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Errors
            </p>
            <ul className="space-y-1 text-sm text-red-600">
              {errors.map((error, index) => (
                <li key={`${error}-${index}`}>• {error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
