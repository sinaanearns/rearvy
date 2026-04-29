"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dispatchBrowserAutomationReply } from "@/lib/browser-use/events";
import { MEMORY_UPDATED_EVENT } from "@/lib/memory-events";
import { BrowserLiveViewer } from "./browser-live-viewer";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  KeyRound,
  Loader2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

type BrowserCredentialSummary = {
  label?: string;
  service?: string;
  loginMask?: string;
  lastUsedAt?: string | null;
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

  const isLocalhost = isClient && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const isElectron = isClient && window.navigator.userAgent.toLowerCase().includes("electron");
  const isWebsite = isClient && !isElectron && !isLocalhost;

  const status =
    typeof data.status === "string" ? data.status.toLowerCase() : null;
  const tone = getStatusTone(status);
  const summary =
    typeof data.summary === "string"
      ? data.summary
      : typeof data.message === "string"
        ? data.message
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
  const handleQuickReply = (prompt: string) => {
    dispatchBrowserAutomationReply(prompt);
  };

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
        {status === "unavailable" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-900/30">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">
                  Website not available
                </p>
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-500/90">
                  Download the app for web automation.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-8 border-amber-200 bg-white text-xs hover:bg-amber-50 dark:border-amber-800 dark:bg-background dark:hover:bg-amber-900/20"
                  asChild
                >
                  <a href="/download">Download App</a>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {showViewer && !isWebsite ? (
          <BrowserLiveViewer
            data={data}
            blocker={blocker}
            summary={summary}
            task={task}
            toneLabel={tone.label}
            fallbackActivityLines={activityLines}
            allowManualControl={false}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              App browser activity pinned beside chat
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rearvy can use the browser for app-controlled workflows, but
              manual browsing is disabled.
            </p>
          </div>
        )}

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
