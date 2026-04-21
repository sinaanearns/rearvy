"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dispatchBrowserAutomationReply } from "@/lib/browser-use/events";
import { MEMORY_UPDATED_EVENT } from "@/lib/memory-events";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
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

export function BrowserCard({ data }: BrowserCardProps) {
  const { user } = useAuth();
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
  const finalUrl =
    typeof data.finalUrl === "string" && data.finalUrl.trim()
      ? data.finalUrl
      : null;
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
  const browserLocation = finalUrl ?? service;
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
  const handleOpenFinalPage = () => {
    if (!finalUrl) {
      return;
    }

    dispatchBrowserAutomationReply(
      task
        ? `Open the final page for the browser task "${task}" at ${finalUrl} inside the browser workflow and continue in chat.`
        : `Open the final page at ${finalUrl} inside the browser workflow and continue in chat.`
    );
  };

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
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-zinc-950 text-zinc-50 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
              <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span className="truncate">{browserLocation}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
              <ChevronRight className="h-3 w-3 text-sky-400" />
              {tone.label}
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-[1.35fr_0.95fr]">
            <div className="border-b border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 md:border-b-0 md:border-r">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  Browser viewport
                </p>
                <div className="mt-3 space-y-3">
                  <p className="text-sm leading-6 text-zinc-100">{summary}</p>
                  {blocker ? (
                    <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Blocker: {blocker}
                    </p>
                  ) : null}
                  {createdEntities.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {createdEntities.map((item, index) => (
                        <span
                          key={`${item}-${index}`}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-0 bg-zinc-900/95 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Activity log
              </p>
              <div className="mt-3 space-y-2">
                {activityLines.length > 0 ? (
                  activityLines.map((line, index) => (
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

              {finalUrl ? (
                <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                  Current page: {finalUrl}
                </div>
              ) : null}
            </div>
          </div>
        </div>

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

        {errors.length > 0 ? (
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

        {finalUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleOpenFinalPage}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Continue browser session in chat
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
