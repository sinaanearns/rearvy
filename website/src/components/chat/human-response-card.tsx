"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_CHAT_ATTACHMENTS_PER_MESSAGE,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
} from "@/lib/chat/attachments";
import { cn } from "@/lib/utils";

type ToolOutputHandler = (params: {
  tool: string;
  toolCallId: string;
  output: unknown;
}) => void | PromiseLike<void>;

type ToolApprovalResponseHandler = (params: {
  id: string;
  approved: boolean;
  reason?: string;
}) => void | PromiseLike<void>;

type HumanResponseCardProps = {
  toolCallId?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  onToolOutput?: ToolOutputHandler;
};

type ToolApprovalCardProps = {
  toolName: string;
  state: string;
  input?: unknown;
  approval?: unknown;
  onToolApprovalResponse?: ToolApprovalResponseHandler;
};

type DesktopWorkflowInlineApprovalCardProps = {
  output: Record<string, unknown>;
};

type Choice = {
  id: string;
  label: string;
  description?: string;
};

type PendingAttachment = {
  id: string;
  file: File;
};

type AutomationBridge = {
  approveWorkflow?: (workflowId: string) => Promise<unknown>;
  rejectWorkflow?: (workflowId: string, reason?: string) => Promise<unknown>;
  getState?: () => Promise<unknown>;
  onStateChange?: (callback: (state: unknown) => void) => () => void;
};

type DesktopWorkflowLiveLog = {
  status?: string;
  errorMessage?: string;
};

type DesktopWorkflowLiveState = {
  workflowId?: string | null;
  sessionId?: string | null;
  state?: string;
  error?: string | null;
  logs?: DesktopWorkflowLiveLog[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function truncateText(value: string, limit = 180) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > limit
    ? `${normalized.slice(0, limit - 3)}...`
    : normalized;
}

function normalizeChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): Choice | null => {
      if (typeof item === "string" && item.trim()) {
        return {
          id: item.trim(),
          label: item.trim(),
        };
      }

      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const label = firstString(record.label, record.title, record.id);
      if (!label) {
        return null;
      }

      return {
        id: firstString(record.id, label) || `choice-${index + 1}`,
        label,
        description: firstString(record.description) || undefined,
      };
    })
    .filter((choice): choice is Choice => choice !== null)
    .slice(0, 6);
}

function summarizeValue(value: unknown) {
  if (typeof value === "string") {
    return truncateText(value);
  }

  const record = asRecord(value);
  if (!record) {
    return "";
  }

  return truncateText(
    firstString(
      record.prompt,
      record.context,
      record.requestedAction,
      record.description,
      record.message,
      record.task,
      record.name
    )
  );
}

function getAskUserInput(input: unknown) {
  const record = asRecord(input) ?? {};
  return {
    kind: firstString(record.kind) || "clarification",
    title: firstString(record.title) || "Please reply to continue",
    prompt: firstString(record.prompt, record.question, record.message),
    placeholder: firstString(record.placeholder) || "Type your reply...",
    context: firstString(record.context),
    requestedAction: firstString(record.requestedAction),
    allowSkip: record.allowSkip !== false,
    sensitive: record.sensitive === true,
    choices: normalizeChoices(record.choices),
  };
}

function getAutomationBridge(): AutomationBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window as Window & {
      electron?: { automation?: AutomationBridge };
    }
  ).electron?.automation ?? null;
}

function getOutputStatus(output: unknown) {
  const record = asRecord(output);
  if (!record) {
    return null;
  }

  const status = firstString(record.status);
  if (status === "answered" || status === "skipped" || status === "rejected") {
    return status;
  }

  return null;
}

function isPendingState(state: string) {
  return (
    state === "input-available" ||
    state === "input-streaming" ||
    state === "approval-requested"
  );
}

function buildAttachmentMetadata(files: PendingAttachment[]) {
  return files.map(({ file }) => ({
    name: file.name || "attachment",
    contentType: file.type || "application/octet-stream",
    size: file.size,
    kind: file.type.startsWith("image/") ? "image" : "file",
  }));
}

function resultFailed(result: unknown) {
  const record = asRecord(result);
  return Boolean(record?.success === false || record?.ok === false);
}

function getResultError(result: unknown, fallback: string) {
  const record = asRecord(result);
  return firstString(record?.error, record?.reason, record?.message) || fallback;
}

function getWorkflowRecord(output: Record<string, unknown>) {
  return asRecord(output.workflow);
}

function getWorkflowId(output: Record<string, unknown>) {
  return firstString(output.workflowId, getWorkflowRecord(output)?.id);
}

function asDesktopWorkflowLiveState(value: unknown): DesktopWorkflowLiveState | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return record as DesktopWorkflowLiveState;
}

function getLiveWorkflowId(state: DesktopWorkflowLiveState | null) {
  return firstString(state?.workflowId, state?.sessionId);
}

function getWorkflowFailedMessage(state: DesktopWorkflowLiveState | null) {
  if (!state) {
    return "";
  }

  const failedLog = [...(state.logs ?? [])]
    .reverse()
    .find((log) => log.status === "failed" && firstString(log.errorMessage));

  return firstString(state.error, failedLog?.errorMessage);
}

function getWorkflowStatusCopy(status: string) {
  if (status === "pending-approval") {
    return "Waiting for approval";
  }

  if (status === "running") {
    return "Desktop workflow running";
  }

  if (status === "completed") {
    return "Desktop workflow completed";
  }

  if (status === "failed") {
    return "Desktop workflow failed";
  }

  if (status === "rejected") {
    return "Desktop workflow rejected";
  }

  if (status === "stopped") {
    return "Desktop workflow stopped";
  }

  return "";
}

export function isPendingDesktopWorkflowOutput(toolName: string, output: unknown) {
  if (toolName !== "planWorkflow" && toolName !== "executeWorkflow") {
    return false;
  }

  const record = asRecord(output);
  if (!record) {
    return false;
  }

  return (
    firstString(record.status) === "pending_approval" ||
    Boolean(record.workflow && getWorkflowId(record))
  );
}

export function HumanResponseCard({
  toolCallId,
  state,
  input,
  output,
  onToolOutput,
}: HumanResponseCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const ask = useMemo(() => getAskUserInput(input), [input]);
  const outputStatus = getOutputStatus(output);
  const pending = isPendingState(state) && !outputStatus;
  const outputRecord = asRecord(output);
  const hasDraft =
    answer.trim().length > 0 || selectedChoice.length > 0 || attachments.length > 0;
  const showReject = ask.kind === "approval" || ask.kind === "sensitive";

  const appendFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const accepted: PendingAttachment[] = [];

    for (const file of files) {
      if (attachments.length + accepted.length >= MAX_CHAT_ATTACHMENTS_PER_MESSAGE) {
        toast.error(`Attach up to ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} files.`);
        break;
      }

      if (file.size > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
        toast.error(`${file.name || "Attachment"} is larger than 15MB.`);
        continue;
      }

      accepted.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
      });
    }

    if (accepted.length > 0) {
      setAttachments((current) => [...current, ...accepted]);
    }
  };

  const respond = async (status: "answered" | "skipped" | "rejected") => {
    if (!toolCallId || !onToolOutput || isSubmitting) {
      return;
    }

    const trimmedAnswer = answer.trim();
    if (status === "answered" && !hasDraft) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onToolOutput({
        tool: "askUser",
        toolCallId,
        output: {
          status,
          ...(trimmedAnswer ? { answer: trimmedAnswer } : {}),
          ...(selectedChoice ? { choice: selectedChoice } : {}),
          ...(attachments.length > 0
            ? { attachments: buildAttachmentMetadata(attachments) }
            : {}),
          respondedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reply.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pending) {
    return (
      <div className="w-full max-w-xl rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              {outputStatus === "skipped"
                ? "Skipped"
                : outputStatus === "rejected"
                  ? "Rejected"
                  : "Reply received"}
            </div>
            {firstString(outputRecord?.answer, outputRecord?.choice) ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {firstString(outputRecord?.answer, outputRecord?.choice)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Rearvy continued with your response.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-lg shadow-emerald-950/5">
      <div className="h-0.5 bg-emerald-500" />
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="min-w-0 truncate text-sm font-semibold text-foreground">
          {ask.title}
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
          <X className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-4 p-4">
        {ask.prompt ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {ask.prompt}
          </p>
        ) : null}
        {ask.context || ask.requestedAction ? (
          <p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
            {ask.context || ask.requestedAction}
          </p>
        ) : null}
        {ask.sensitive ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>This reply may contain sensitive information.</span>
          </div>
        ) : null}

        {ask.choices.length > 0 ? (
          <div className="grid gap-2">
            {ask.choices.map((choice) => {
              const active = selectedChoice === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => setSelectedChoice(active ? "" : choice.id)}
                  className={cn(
                    "flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border/70 bg-background/70 hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      active
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/40"
                    )}
                  >
                    {active ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {choice.label}
                    </span>
                    {choice.description ? (
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {choice.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={ask.placeholder}
          className="min-h-24 resize-none rounded-xl"
          disabled={isSubmitting}
        />

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{attachment.file.name || "attachment"}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.id !== attachment.id)
                    )
                  }
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                appendFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              <Paperclip className="h-4 w-4" />
              Attach
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {ask.allowSkip ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void respond("skipped")}
                disabled={isSubmitting}
              >
                Skip
              </Button>
            ) : null}
            {showReject ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void respond("rejected")}
                disabled={isSubmitting}
              >
                Reject
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => void respond("answered")}
              disabled={!hasDraft || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolApprovalCard({
  toolName,
  state,
  input,
  approval,
  onToolApprovalResponse,
}: ToolApprovalCardProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const approvalRecord = asRecord(approval);
  const approvalId = firstString(approvalRecord?.id);
  const approved = approvalRecord?.approved;
  const isResponded = state === "approval-responded" && typeof approved === "boolean";
  const prompt = summarizeValue(input) || `Allow ${toolName} to continue?`;

  const respond = async (nextApproved: boolean) => {
    if (!approvalId || !onToolApprovalResponse || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onToolApprovalResponse({
        id: approvalId,
        approved: nextApproved,
        reason: reason.trim() || undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit approval.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-200">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            {isResponded
              ? approved
                ? "Approved"
                : "Rejected"
              : "Approval required"}
          </div>
          <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
            {prompt}
          </p>

          {!isResponded ? (
            <div className="mt-3 space-y-3">
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional note..."
                className="min-h-16 resize-none rounded-xl bg-background/80"
                disabled={isSubmitting}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void respond(true)}
                  disabled={!approvalId || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void respond(false)}
                  disabled={!approvalId || isSubmitting}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DesktopWorkflowInlineApprovalCard({
  output,
}: DesktopWorkflowInlineApprovalCardProps) {
  const [status, setStatus] = useState<"idle" | "approving" | "rejecting" | "approved" | "rejected">("idle");
  const [error, setError] = useState("");
  const [liveState, setLiveState] = useState<DesktopWorkflowLiveState | null>(null);
  const workflow = getWorkflowRecord(output);
  const workflowId = getWorkflowId(output);
  const title = firstString(output.name, workflow?.name) || "Desktop workflow";
  const message =
    firstString(output.message, output.description, workflow?.description) ||
    "Approve this workflow before Rearvy controls your desktop.";
  const liveWorkflowStatus = firstString(liveState?.state);
  const liveWorkflowError = getWorkflowFailedMessage(liveState);
  const statusCopy = liveWorkflowStatus
    ? getWorkflowStatusCopy(liveWorkflowStatus)
    : "";
  const displayMessage =
    liveWorkflowStatus && liveWorkflowStatus !== "pending-approval"
      ? liveWorkflowError || statusCopy || message
      : message;
  const canActOnLiveWorkflow =
    !liveWorkflowStatus || liveWorkflowStatus === "pending-approval";

  const refreshLiveState = useCallback(async () => {
    if (!workflowId) {
      return;
    }

    const automation = getAutomationBridge();
    if (!automation?.getState) {
      return;
    }

    const nextState = asDesktopWorkflowLiveState(await automation.getState());
    if (getLiveWorkflowId(nextState) === workflowId) {
      setLiveState(nextState);
    }
  }, [workflowId]);

  useEffect(() => {
    if (!workflowId || typeof window === "undefined") {
      return;
    }

    const automation = getAutomationBridge();
    void refreshLiveState();

    const unsubscribe = automation?.onStateChange?.((nextState: unknown) => {
      const normalizedState = asDesktopWorkflowLiveState(nextState);
      if (getLiveWorkflowId(normalizedState) === workflowId) {
        setLiveState(normalizedState);
      }
    });

    window.addEventListener("focus", refreshLiveState);

    return () => {
      unsubscribe?.();
      window.removeEventListener("focus", refreshLiveState);
    };
  }, [refreshLiveState, workflowId]);

  const runAction = async (action: "approve" | "reject") => {
    if (!workflowId) {
      setError("Missing workflow ID.");
      return;
    }

    if (!canActOnLiveWorkflow) {
      setError(
        liveWorkflowError ||
          statusCopy ||
          "This workflow is no longer waiting for approval."
      );
      return;
    }

    const automation = getAutomationBridge();
    if (!automation) {
      setError("Desktop automation bridge is unavailable.");
      return;
    }

    setStatus(action === "approve" ? "approving" : "rejecting");
    setError("");

    try {
      let result: unknown;
      if (action === "approve") {
        if (!automation.approveWorkflow) {
          throw new Error("Desktop workflow approval is unavailable.");
        }
        result = await automation.approveWorkflow(workflowId);
      } else {
        if (!automation.rejectWorkflow) {
          throw new Error("Desktop workflow rejection is unavailable.");
        }
        result = await automation.rejectWorkflow(workflowId, "Rejected from chat.");
      }

      if (resultFailed(result)) {
        throw new Error(
          getResultError(result, `Failed to ${action} workflow.`)
        );
      }
      setStatus(action === "approve" ? "approved" : "rejected");
      await refreshLiveState();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setStatus("idle");
      void refreshLiveState();
    }
  };

  return (
    <div className="w-full max-w-xl rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-200">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            {statusCopy ||
            (status === "approved"
              ? "Desktop workflow approved"
              : status === "rejected"
                ? "Desktop workflow rejected"
                : title)}
          </div>
          <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
            {displayMessage}
          </p>
          {liveWorkflowStatus && liveWorkflowStatus !== "pending-approval" ? (
            <div
              className={cn(
                "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                liveWorkflowStatus === "failed" ||
                  liveWorkflowStatus === "stopped" ||
                  liveWorkflowStatus === "rejected"
                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                  : "border-border bg-muted/60 text-muted-foreground"
              )}
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {liveWorkflowError ||
                  statusCopy ||
                  "This workflow is no longer pending approval."}
              </span>
            </div>
          ) : error ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {canActOnLiveWorkflow &&
          (status === "idle" || status === "approving" || status === "rejecting") ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void runAction("approve")}
                disabled={status !== "idle"}
              >
                {status === "approving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void runAction("reject")}
                disabled={status !== "idle"}
              >
                {status === "rejecting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
