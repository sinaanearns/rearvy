"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
  stepId?: string;
  stepName?: string;
  action?: string;
  status?: string;
  errorMessage?: string;
  result?: unknown;
};

type DesktopWorkflowLiveState = {
  workflowId?: string | null;
  sessionId?: string | null;
  state?: string;
  error?: string | null;
  logs?: DesktopWorkflowLiveLog[];
  screenshotDataUrl?: string | null;
};

type DesktopWorkflowStepPreview = {
  id: string;
  name: string;
  action: string;
  detail?: string;
};

type DesktopWorkflowEvidenceItem = {
  id: string;
  title: string;
  body: string;
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

function formatWorkflowEvidenceResult(result: unknown) {
  if (typeof result === "string") {
    return result.trim();
  }

  const record = asRecord(result);
  if (record) {
    const stdout = firstString(record.stdout);
    const stderr = firstString(record.stderr);
    const exitCode =
      typeof record.exitCode === "number" ? `exit ${record.exitCode}` : "";
    const parts = [exitCode, stdout, stderr ? `stderr: ${stderr}` : ""].filter(Boolean);
    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  if (result == null) {
    return "";
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function getWorkflowEvidenceItems(state: DesktopWorkflowLiveState | null) {
  const logs = Array.isArray(state?.logs) ? state.logs : [];
  return logs
    .filter((log) => log.status === "completed" && log.result != null)
    .map((log, index): DesktopWorkflowEvidenceItem | null => {
      const body = formatWorkflowEvidenceResult(log.result);
      if (!body) {
        return null;
      }

      return {
        id: `${log.stepId || "step"}_${index}`,
        title: firstString(log.stepName, log.action) || `Step ${index + 1}`,
        body: truncateText(body, 900),
      };
    })
    .filter((item): item is DesktopWorkflowEvidenceItem => Boolean(item))
    .slice(-3);
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

function getWorkflowScreenshotDataUrl(state: DesktopWorkflowLiveState | null) {
  const dataUrl = firstString(state?.screenshotDataUrl);
  return dataUrl.startsWith("data:image/") ? dataUrl : "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value);
    }
  }

  return null;
}

function formatPoint(x: unknown, y: unknown) {
  const nextX = firstNumber(x);
  const nextY = firstNumber(y);
  return nextX !== null && nextY !== null ? `${nextX},${nextY}` : "";
}

function formatWorkflowActionDetail(action: Record<string, unknown> | null) {
  if (!action) {
    return "";
  }

  const actionType = firstString(action.type);
  const point = formatPoint(action.x, action.y);
  const dragFrom = formatPoint(action.fromX, action.fromY);
  const dragTo = formatPoint(action.toX ?? action.x, action.toY ?? action.y);

  if (actionType === "click") {
    const button = firstString(action.button) || "left";
    return [
      point ? `at ${point}` : "",
      button !== "left" ? button : "",
      action.double === true ? "double" : "",
    ].filter(Boolean).join(" ");
  }

  if (actionType === "clickElement") {
    const label = truncateText(firstString(action.text, action.label, action.target) || "element", 80);
    const controlType = firstString(action.controlType);
    const button = firstString(action.button) || "left";
    return [
      `"${label}"`,
      controlType ? `(${controlType})` : "",
      button !== "left" ? button : "",
      action.double === true ? "double" : "",
    ].filter(Boolean).join(" ");
  }

  if (actionType === "moveMouse") {
    return point ? `to ${point}` : "";
  }

  if (actionType === "dragMouse") {
    return [
      dragFrom ? `from ${dragFrom}` : "",
      dragTo ? `to ${dragTo}` : "",
      firstString(action.button) ? `(${firstString(action.button)})` : "",
    ].filter(Boolean).join(" ");
  }

  if (actionType === "mouseDown" || actionType === "mouseUp") {
    return firstString(action.button) || "left";
  }

  if (actionType === "scroll") {
    return [
      firstString(action.direction) || "down",
      firstNumber(action.amount) ?? "",
    ].filter((item) => item !== "").join(" ");
  }

  if (actionType === "setClipboard") {
    return truncateText(firstString(action.text) || "text", 80);
  }

  if (actionType === "getClipboard") {
    return "read clipboard";
  }

  if (actionType === "type") {
    return truncateText(firstString(action.text) || "text", 80);
  }

  if (actionType === "closeWindow") {
    return action.force === true ? "force close" : "close";
  }

  if (actionType === "focusWindow") {
    return firstString(action.windowTitle, action.title, action.name, action.target);
  }

  if (actionType === "listWindows") {
    return "open windows";
  }

  if (actionType === "readVisibleText") {
    const limit = firstString(action.maxTextItems, action.maxElements, action.maxItems);
    return ["visible text", limit ? `limit ${limit}` : ""].filter(Boolean).join(" ");
  }

  if (actionType === "getElementState") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const type = firstString(action.controlType, action.role, action.kind);
    return [target || "element", type ? `(${type})` : ""].filter(Boolean).join(" ");
  }

  if (actionType === "getElementValue") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const type = firstString(action.controlType, action.role, action.kind);
    return [target || "field", type ? `(${type})` : ""].filter(Boolean).join(" ");
  }

  if (actionType === "invokeElement") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const type = firstString(action.controlType, action.role, action.kind);
    return [target || "element", type ? `(${type})` : ""].filter(Boolean).join(" ");
  }

  if (actionType === "listUiElements") {
    const filter = firstString(action.controlType, action.role, action.kind);
    const limit = firstString(action.maxElements, action.maxItems, action.maxEntries);
    return ["visible UI elements", filter ? `(${filter})` : "", limit ? `limit ${limit}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (actionType === "typeIntoElement") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const value = firstString(action.value, action.textToType, action.input, action.content);
    return [target ? `${target}` : "field", value ? `(${value.length} chars)` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (actionType === "setElementValue") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const value = firstString(action.value, action.textToSet, action.input, action.content);
    return [target ? `${target}` : "field", value ? `(${value.length} chars)` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (actionType === "selectOption") {
    const option = firstString(action.option, action.value, action.optionText, action.selection);
    const target = firstString(action.text, action.label, action.name, action.target);
    return [option ? `"${option}"` : "option", target ? `from ${target}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (actionType === "setToggleState") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const state = firstString(action.state, action.checked, action.value, action.mode);
    return [target || "toggle", state ? `-> ${state}` : ""].filter(Boolean).join(" ");
  }

  if (actionType === "waitForElement") {
    const target = firstString(action.text, action.label, action.name, action.target);
    const type = firstString(action.controlType, action.role, action.kind);
    return [target || "element", type ? `(${type})` : ""].filter(Boolean).join(" ");
  }

  if (actionType === "setWindowState") {
    const state = firstString(action.state, action.windowState, action.mode, action.targetState);
    const target = firstString(action.windowTitle, action.title, action.name, action.target);
    return [state, target].filter(Boolean).join(" ");
  }

  if (actionType === "copyPath" || actionType === "movePath") {
    const source = firstString(action.sourcePath, action.fromPath, action.path, action.filePath, action.directoryPath);
    const destination = firstString(action.destinationPath, action.toPath, action.target);
    const flags = [
      action.overwrite === true || action.force === true ? "overwrite" : "",
      action.reveal === true ||
      action.revealAfterCopy === true ||
      action.revealAfterMove === true
        ? "reveal"
        : "",
      action.open === true ||
      action.openAfterCopy === true ||
      action.openAfterMove === true
        ? "open"
        : "",
    ].filter(Boolean);

    return [
      source && destination
        ? `${source} -> ${destination}`
        : source || destination,
      flags.length ? `(${flags.join(", ")})` : "",
    ].filter(Boolean).join(" ");
  }

  if (actionType === "trashPath") {
    return firstString(
      action.path,
      action.filePath,
      action.directoryPath,
      action.target,
      action.sourcePath,
      action.fromPath
    );
  }

  if (actionType === "appendToFile") {
    const target = firstString(action.path, action.filePath, action.target);
    const content = firstString(action.content, action.text, action.append, action.value);
    const flags = [
      action.backup === false ? "no backup" : "",
      action.newline === false || action.appendNewline === false ? "raw" : "newline",
      action.reveal === true ||
      action.revealAfterAppend === true ||
      action.revealAfterWrite === true
        ? "reveal"
        : "",
      action.open === true ||
      action.openAfterAppend === true ||
      action.openAfterWrite === true
        ? "open"
        : "",
    ].filter(Boolean);

    return [
      target,
      content ? `+"${truncateText(content, 40)}"` : "",
      flags.length ? `(${flags.join(", ")})` : "",
    ].filter(Boolean).join(" ");
  }

  if (actionType === "replaceInFile") {
    const target = firstString(action.path, action.filePath, action.target);
    const search = firstString(action.search, action.find, action.oldText, action.fromText);
    const replacement = firstString(action.replacement, action.replaceWith, action.newText, action.toText);
    const flags = [
      action.backup === false ? "no backup" : "",
      action.all === true || action.replaceAll === true ? "all" : "",
      action.reveal === true ||
      action.revealAfterReplace === true ||
      action.revealAfterWrite === true
        ? "reveal"
        : "",
      action.open === true ||
      action.openAfterReplace === true ||
      action.openAfterWrite === true
        ? "open"
        : "",
    ].filter(Boolean);

    return [
      target,
      search ? `"${truncateText(search, 40)}" -> "${truncateText(replacement ?? "", 40)}"` : "",
      flags.length ? `(${flags.join(", ")})` : "",
    ].filter(Boolean).join(" ");
  }

  const primaryDetail = firstString(
    action.appPath,
    action.target,
    action.path,
    action.filePath,
    action.directoryPath,
    action.command,
    action.key,
    action.text
  );
  if (action.type !== "writeFile") {
    return primaryDetail;
  }

  const flags = [
    action.backup === false ? "no backup" : "",
    action.reveal === true || action.revealAfterWrite === true ? "reveal" : "",
    action.open === true || action.openAfterWrite === true ? "open" : "",
  ].filter(Boolean);

  return [primaryDetail, flags.length ? `(${flags.join(", ")})` : ""]
    .filter(Boolean)
    .join(" ");
}

function getWorkflowStepPreviews(workflow: Record<string, unknown> | null): DesktopWorkflowStepPreview[] {
  const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  return steps
    .map((step, index): DesktopWorkflowStepPreview | null => {
      const record = asRecord(step);
      const action = asRecord(record?.action);
      const actionType = firstString(action?.type);
      const name = firstString(record?.name) || `Step ${index + 1}`;

      if (!record || !actionType) {
        return null;
      }

      return {
        id: firstString(record.id) || `${actionType}-${index}`,
        name,
        action: actionType,
        detail: formatWorkflowActionDetail(action),
      };
    })
    .filter((step): step is DesktopWorkflowStepPreview => Boolean(step))
    .slice(0, 8);
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
      <div className="w-full max-w-xl rounded-[8px] border border-border/70 bg-card/80 p-4 shadow-sm shadow-slate-950/[0.03]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
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
    <div className="w-full max-w-xl overflow-hidden rounded-[8px] border border-border/80 bg-card/95 shadow-sm shadow-emerald-950/[0.03]">
      <div className="h-0.5 bg-emerald-500" />
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="min-w-0 truncate text-sm font-semibold text-foreground">
          {ask.title}
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground">
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
          <div className="flex items-start gap-2 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-200">
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
                    "flex min-w-0 items-start gap-2 rounded-[8px] border px-3 py-2 text-left transition-colors",
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
          className="min-h-24 resize-none rounded-[8px]"
          disabled={isSubmitting}
        />

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-[8px] border border-border/70 bg-background/70 px-2.5 py-1.5 text-xs text-muted-foreground"
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
    <div className="w-full max-w-xl rounded-[8px] border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm shadow-amber-950/[0.03]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-amber-500/15 text-amber-700 dark:text-amber-200">
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
                className="min-h-16 resize-none rounded-[8px] bg-background/80"
                disabled={isSubmitting}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void respond(true)}
                  disabled={!approvalId || isSubmitting}
                  className="rounded-[8px]"
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
                  className="rounded-[8px]"
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
  const plannedSteps = getWorkflowStepPreviews(workflow);
  const title = firstString(output.name, workflow?.name) || "Desktop workflow";
  const message =
    firstString(output.message, output.description, workflow?.description) ||
    "Approve this workflow before Rearvy controls your desktop.";
  const liveWorkflowStatus = firstString(liveState?.state);
  const liveWorkflowError = getWorkflowFailedMessage(liveState);
  const screenshotDataUrl = getWorkflowScreenshotDataUrl(liveState);
  const evidenceItems = getWorkflowEvidenceItems(liveState);
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
    <div className="w-full max-w-xl rounded-[8px] border border-violet-500/30 bg-violet-500/10 p-4 shadow-sm shadow-violet-950/[0.03]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-violet-500/15 text-violet-700 dark:text-violet-200">
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
          {plannedSteps.length > 0 && canActOnLiveWorkflow ? (
            <div className="mt-3 rounded-[8px] border border-border bg-background/70 p-3">
              <div className="text-xs font-medium text-muted-foreground">
                Planned steps
              </div>
              <ol className="mt-2 space-y-2">
                {plannedSteps.map((step, index) => (
                  <li key={step.id} className="flex gap-2 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[8px] bg-muted text-[10px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{step.name}</span>
                      <span className="ml-2 rounded-[8px] bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {step.action}
                      </span>
                      {step.detail ? (
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                          {step.detail}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {screenshotDataUrl ? (
            <div className="mt-3 overflow-hidden rounded-[8px] border border-border bg-background">
              <Image
                src={screenshotDataUrl}
                alt="Desktop workflow screenshot"
                width={960}
                height={540}
                unoptimized
                className="max-h-72 w-full object-contain"
              />
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Latest screenshot captured by the desktop workflow.
              </div>
            </div>
          ) : null}
          {evidenceItems.length > 0 ? (
            <div className="mt-3 rounded-[8px] border border-border bg-background/70 p-3">
              <div className="text-xs font-medium text-muted-foreground">
                Evidence
              </div>
              <div className="mt-2 space-y-2">
                {evidenceItems.map((item) => (
                  <div key={item.id} className="rounded-[8px] bg-muted/70 p-2">
                    <div className="text-xs font-medium text-foreground">
                      {item.title}
                    </div>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                      {item.body}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {liveWorkflowStatus && liveWorkflowStatus !== "pending-approval" ? (
            <div
              className={cn(
                "mt-3 flex items-start gap-2 rounded-[8px] border px-3 py-2 text-xs",
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
            <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-200">
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
                className="rounded-[8px]"
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
                className="rounded-[8px]"
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
