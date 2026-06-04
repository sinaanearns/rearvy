"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FilePenLine,
  Loader2,
  Mail,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  GmailComposeCapabilities,
  GmailComposePayload,
  GmailComposeToolResult,
  GmailSendAsOption,
} from "@/lib/integrations/gmail/compose-shared";
import { DataCardFrame, DataCardMessage } from "./data-card-frame";

interface GmailComposeCardProps {
  data: Record<string, unknown>;
}

type PersistAction = "draft" | "send";

type PersistResult = {
  action: PersistAction;
  id: string | null;
  threadId: string | null;
  fromEmail: string;
  message: string;
  performedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseSendAsOption(value: unknown): GmailSendAsOption | null {
  if (!isRecord(value) || typeof value.email !== "string") {
    return null;
  }

  return {
    email: value.email,
    displayName:
      typeof value.displayName === "string" ? value.displayName : null,
    isPrimary: value.isPrimary === true,
    isDefault: value.isDefault === true,
    replyToAddress:
      typeof value.replyToAddress === "string" ? value.replyToAddress : null,
  };
}

function parseCapabilities(value: unknown): GmailComposeCapabilities | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    canCreateDraft: value.canCreateDraft === true,
    canSend: value.canSend === true,
  };
}

function parseDraft(value: unknown): GmailComposePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isStringArray(value.to) ||
    !isStringArray(value.cc) ||
    !isStringArray(value.bcc) ||
    typeof value.subject !== "string" ||
    typeof value.body !== "string"
  ) {
    return null;
  }

  return {
    to: value.to,
    cc: value.cc,
    bcc: value.bcc,
    subject: value.subject,
    body: value.body,
  };
}

function parseComposeResult(data: Record<string, unknown>): GmailComposeToolResult | null {
  if (data.kind !== "gmail-compose-review" || typeof data.ok !== "boolean") {
    return null;
  }

  if (data.ok === false) {
    if (
      typeof data.errorCode !== "string" ||
      typeof data.message !== "string" ||
      typeof data.reconnectRequired !== "boolean"
    ) {
      return null;
    }

    return {
      kind: "gmail-compose-review",
      ok: false,
      errorCode: data.errorCode,
      message: data.message,
      reconnectRequired: data.reconnectRequired,
    };
  }

  const selectedFrom = parseSendAsOption(data.selectedFrom);
  const availableFrom = Array.isArray(data.availableFrom)
    ? data.availableFrom
        .map((option) => parseSendAsOption(option))
        .filter((option): option is GmailSendAsOption => Boolean(option))
    : [];
  const draft = parseDraft(data.draft);
  const capabilities = parseCapabilities(data.capabilities);

  if (
    typeof data.message !== "string" ||
    typeof data.accountName !== "string" ||
    !selectedFrom ||
    availableFrom.length === 0 ||
    !draft ||
    (data.defaultAction !== "draft" && data.defaultAction !== "send") ||
    !capabilities ||
    typeof data.reconnectRequired !== "boolean"
  ) {
    return null;
  }

  return {
    kind: "gmail-compose-review",
    ok: true,
    message: data.message,
    accountName: data.accountName,
    selectedFrom,
    availableFrom,
    draft,
    defaultAction: data.defaultAction,
    capabilities,
    reconnectRequired: data.reconnectRequired,
    warning: typeof data.warning === "string" ? data.warning : null,
  };
}

function getActionTone(action: PersistAction, isSelected: boolean) {
  if (action === "send") {
    return isSelected
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
      : "border-border/70 bg-background/70 text-muted-foreground";
  }

  return isSelected
    ? "border-sky-500/50 bg-sky-500/10 text-sky-700"
    : "border-border/70 bg-background/70 text-muted-foreground";
}

function formatMailbox(option: GmailSendAsOption) {
  return option.displayName
    ? `${option.displayName} <${option.email}>`
    : option.email;
}

function FieldLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-medium text-muted-foreground">
      {children}
    </p>
  );
}

function renderAddressList(label: string, values: string[]) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={`${label}-${value}`}
            className="rounded-[8px] border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-foreground"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function GmailComposeCard({ data }: GmailComposeCardProps) {
  const { user, loading } = useAuth();
  const parsed = useMemo(() => parseComposeResult(data), [data]);
  const [selectedAction, setSelectedAction] = useState<PersistAction>("draft");
  const [selectedFromEmail, setSelectedFromEmail] = useState("");
  const [draftTo, setDraftTo] = useState<string[]>([]);
  const [draftCc, setDraftCc] = useState<string[]>([]);
  const [draftBcc, setDraftBcc] = useState<string[]>([]);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [result, setResult] = useState<PersistResult | null>(null);

  useEffect(() => {
    if (!parsed || !parsed.ok) {
      setSelectedAction("draft");
      setSelectedFromEmail("");
      setResult(null);
      return;
    }

    const nextAction =
      parsed.defaultAction === "send" && parsed.capabilities.canSend
        ? "send"
        : parsed.capabilities.canCreateDraft
          ? "draft"
          : parsed.capabilities.canSend
            ? "send"
            : "draft";

    setSelectedAction(nextAction);
    setSelectedFromEmail(parsed.selectedFrom.email);
    setDraftTo(parsed.draft.to);
    setDraftCc(parsed.draft.cc);
    setDraftBcc(parsed.draft.bcc);
    setDraftSubject(parsed.draft.subject);
    setDraftBody(parsed.draft.body);
    setResult(null);
  }, [parsed]);

  if (!parsed) {
    return (
      <DataCardMessage
        icon={AlertCircle}
        title="Gmail review"
        tone="amber"
        message="Rearvy prepared Gmail output, but it could not be rendered as a review card."
      />
    );
  }

  if (!parsed.ok) {
    return (
      <DataCardFrame
        icon={Mail}
        title="Gmail review"
        subtitle="Connect or refresh Gmail before sending."
        tone="amber"
      >
          <div className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Gmail action unavailable</p>
                <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
                  {parsed.message}
                </p>
              </div>
            </div>
          </div>
          {parsed.reconnectRequired ? (
            <Button asChild variant="outline">
              <a href="/work/integrations">Open integrations</a>
            </Button>
          ) : null}
      </DataCardFrame>
    );
  }

  const canUseDraft = parsed.capabilities.canCreateDraft;
  const canUseSend = parsed.capabilities.canSend;
  const canRunSelectedAction =
    selectedAction === "send" ? canUseSend : canUseDraft;
  const selectedFromOption =
    parsed.availableFrom.find((option) => option.email === selectedFromEmail) ||
    parsed.selectedFrom;
  const actionLabel = selectedAction === "send" ? "Send email" : "Create draft";
  const actionSummary =
    selectedAction === "send"
      ? "Rearvy will send this email through the selected Gmail account after you confirm."
      : "Rearvy will save this as a Gmail draft so you can review it again in Gmail later.";

  const handlePersist = async () => {
    if (!user) {
      toast.error("Sign in to create a Gmail draft or send email.");
      return;
    }

    if (!canRunSelectedAction) {
      toast.error(
        selectedAction === "send"
          ? "This Gmail connection cannot send yet. Reconnect Gmail first."
          : "This Gmail connection cannot create drafts yet. Reconnect Gmail first."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/integrations/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: selectedAction,
          fromEmail: selectedFromOption.email,
          draft: {
            ...parsed.draft,
            to: draftTo,
            cc: draftCc,
            bcc: draftBcc,
            subject: draftSubject,
            body: draftBody,
          },
        }),
      });

      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Gmail action failed."
        );
      }

      const nextResult: PersistResult = {
        action: selectedAction,
        id: typeof payload.id === "string" ? payload.id : null,
        threadId: typeof payload.threadId === "string" ? payload.threadId : null,
        fromEmail:
          typeof payload.fromEmail === "string"
            ? payload.fromEmail
            : selectedFromOption.email,
        message:
          typeof payload.message === "string"
            ? payload.message
            : selectedAction === "send"
              ? "Email sent successfully."
              : "Draft created successfully.",
        performedAt:
          typeof payload.performedAt === "string"
            ? payload.performedAt
            : new Date().toISOString(),
      };

      setResult(nextResult);
      toast.success(nextResult.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gmail action failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiRefine = async () => {
    if (!user) {
      toast.error("Sign in to use AI refinement.");
      return;
    }

    setIsRefining(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ai/refine-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
          body: JSON.stringify({
            subject: draftSubject,
            body: draftBody,
            to: draftTo,
            cc: draftCc,
            bcc: draftBcc,
          }),
      });

      if (!response.ok) {
        throw new Error("AI refinement failed.");
      }

      const payload = await response.json();
      if (typeof payload.subject === "string") setDraftSubject(payload.subject);
      if (typeof payload.body === "string") setDraftBody(payload.body);
      toast.success("Email refined with AI!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "AI refinement failed."
      );
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <DataCardFrame
      icon={Mail}
      title="Gmail review"
      subtitle={parsed.message}
      tone="cyan"
      className="max-w-3xl"
      accessory={
        <span className="rounded-[8px] border border-border/60 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {parsed.accountName}
        </span>
      }
    >
        {parsed.warning ? (
          <div className="rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{parsed.warning}</p>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {result.action === "send" ? "Email sent" : "Draft created"}
                </p>
                <p className="mt-1 text-emerald-900/80 dark:text-emerald-100/80">
                  {result.message}
                </p>
                <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                  {result.fromEmail} at{" "}
                  {new Date(result.performedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <FieldLabel>From</FieldLabel>
              {parsed.availableFrom.length > 1 ? (
                <select
                  value={selectedFromEmail}
                  onChange={(event) => setSelectedFromEmail(event.target.value)}
                  className="h-10 w-full rounded-[8px] border border-border/70 bg-background px-3 text-sm text-foreground"
                  disabled={isSubmitting}
                >
                  {parsed.availableFrom.map((option) => (
                    <option key={option.email} value={option.email}>
                      {formatMailbox(option)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-[8px] border border-border/70 bg-background/70 px-3 py-2.5 text-sm text-foreground">
                  {formatMailbox(selectedFromOption)}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <FieldLabel>To</FieldLabel>
              <Input
                value={draftTo.join(", ")}
                onChange={(e) =>
                  setDraftTo(
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="h-10 rounded-[8px] border-border/70 bg-background/70 px-3 text-sm"
                placeholder="recipient@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Cc</FieldLabel>
              <Input
                value={draftCc.join(", ")}
                onChange={(e) =>
                  setDraftCc(
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="h-10 rounded-[8px] border-border/70 bg-background/70 px-3 text-sm"
                placeholder="cc@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Bcc</FieldLabel>
              <Input
                value={draftBcc.join(", ")}
                onChange={(e) =>
                  setDraftBcc(
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                  )
                }
                className="h-10 rounded-[8px] border-border/70 bg-background/70 px-3 text-sm"
                placeholder="bcc@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel>Subject</FieldLabel>
              <Input
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                className="h-10 rounded-[8px] border-border/70 bg-background/70 px-3 text-sm"
                placeholder="Email subject"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <FieldLabel>Message</FieldLabel>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[10px] text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                  onClick={handleAiRefine}
                  disabled={isSubmitting || isRefining}
                >
                  {isRefining ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  AI Refine
                </Button>
              </div>
              <Textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="min-h-64 rounded-[8px] border-border/70 bg-background/70 px-3 py-3 text-sm leading-6 whitespace-pre-wrap"
                placeholder="Email body..."
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-border/70 bg-background/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-[8px] border px-3 py-1.5 text-sm font-medium transition-colors ${getActionTone(
                "draft",
                selectedAction === "draft"
              )} ${!canUseDraft ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => canUseDraft && setSelectedAction("draft")}
              disabled={!canUseDraft || isSubmitting}
            >
              Draft only
            </button>
            <button
              type="button"
              className={`rounded-[8px] border px-3 py-1.5 text-sm font-medium transition-colors ${getActionTone(
                "send",
                selectedAction === "send"
              )} ${!canUseSend ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => canUseSend && setSelectedAction("send")}
              disabled={!canUseSend || isSubmitting}
            >
              Send now
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{actionSummary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handlePersist}
            disabled={isSubmitting || loading || !user || !canRunSelectedAction}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : selectedAction === "send" ? (
              <Send className="mr-2 h-4 w-4" />
            ) : (
              <FilePenLine className="mr-2 h-4 w-4" />
            )}
            {actionLabel}
          </Button>

          {!user && !loading ? (
            <p className="text-xs text-muted-foreground">
              Sign in to use Gmail actions.
            </p>
          ) : null}

          {selectedAction === "draft" && !canUseDraft ? (
            <p className="text-xs text-amber-700">
              Reconnect Gmail to enable draft creation.
            </p>
          ) : null}

          {selectedAction === "send" && !canUseSend ? (
            <p className="text-xs text-amber-700">
              Reconnect Gmail to enable sending.
            </p>
          ) : null}
        </div>
    </DataCardFrame>
  );
}
