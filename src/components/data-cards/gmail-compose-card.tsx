"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FilePenLine,
  Loader2,
  Mail,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  GmailComposeCapabilities,
  GmailComposePayload,
  GmailComposeToolResult,
  GmailSendAsOption,
} from "@/lib/integrations/gmail/compose-shared";

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

function renderAddressList(label: string, values: string[]) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={`${label}-${value}`}
            className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs text-foreground"
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setResult(null);
  }, [parsed]);

  if (!parsed) {
    return (
      <Card className="w-full border-border/70 bg-card/80">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Rearvy prepared Gmail output, but it could not be rendered as a review card.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!parsed.ok) {
    return (
      <Card className="w-full border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Gmail review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Gmail action unavailable</p>
                <p className="mt-1 text-sm text-amber-900/80">{parsed.message}</p>
              </div>
            </div>
          </div>
          {parsed.reconnectRequired ? (
            <Button asChild variant="outline">
              <a href="/integrations">Open integrations</a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
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
          draft: parsed.draft,
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

  return (
    <Card className="w-full border-border/70 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Gmail review
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {parsed.message}
            </p>
          </div>
          <div className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {parsed.accountName}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {parsed.warning ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{parsed.warning}</p>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {result.action === "send" ? "Email sent" : "Draft created"}
                </p>
                <p className="mt-1 text-emerald-900/80">{result.message}</p>
                <p className="mt-1 text-xs text-emerald-900/70">
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                From
              </p>
              {parsed.availableFrom.length > 1 ? (
                <select
                  value={selectedFromEmail}
                  onChange={(event) => setSelectedFromEmail(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground"
                  disabled={isSubmitting}
                >
                  {parsed.availableFrom.map((option) => (
                    <option key={option.email} value={option.email}>
                      {formatMailbox(option)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm text-foreground">
                  {formatMailbox(selectedFromOption)}
                </div>
              )}
            </div>

            {renderAddressList("To", parsed.draft.to)}
            {renderAddressList("Cc", parsed.draft.cc)}
            {renderAddressList("Bcc", parsed.draft.bcc)}

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Subject
              </p>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm text-foreground">
                {parsed.draft.subject}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Message
              </p>
              <div className="min-h-48 rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm leading-6 text-foreground whitespace-pre-wrap">
                {parsed.draft.body}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${getActionTone(
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
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${getActionTone(
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
      </CardContent>
    </Card>
  );
}
