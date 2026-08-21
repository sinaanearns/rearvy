"use client";

import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback, type WheelEvent } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ComputerUseBanner } from "./computer-use-banner";
import { getIdToken } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { ChatTemplates } from "./chat-templates";
import { TokenUsageMeter } from "./token-usage-meter";
import { BrowserWorkspacePane } from "./browser-workspace-pane";
import DesktopWorkspacePane from "./desktop-workspace-pane";
import type { ReasoningEffort, ModelSpeed } from "./model-selector-menu";
import {
  readBrowserWorkspacePreference,
  writeBrowserWorkspacePreference,
  BROWSER_WORKSPACE_PREFERENCE_KEY,
} from "@/lib/chat/browser-preferences";
import { isSafeGeneratedMediaMimeType } from "@/lib/chat/generated-media-url";
import { normalizeScreenshotDataUrl } from "@/lib/chat/screenshot-data-url";


import { AlertCircle, Monitor, Brain, Globe, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_CHAT_MODEL_TIER,
  resolveChatProviderModel,
  type ChatModelTier,
} from "@/lib/ai/models";
import {
  DEFAULT_CHAT_MAX_OUTPUT_TOKENS,
  buildChatTokenUsageMetadata,
  isChatTokenUsageMetadata,
  type ChatTokenUsageMetadata,
} from "@/lib/ai/token-usage";
import {
  savePendingChatRouteHandoff,
  type ChatRouteMessage,
} from "@/lib/chat-route-handoff";
import { MEMORY_UPDATED_EVENT } from "@/lib/memory-events";
import {
  getChatSessionKey,
  getOrCreateChatClientSession,
  hydrateChatClientSessionMessages,
  promoteChatClientSession,
  updateChatClientSessionRequest,
  type PersistentChatMessage,
} from "@/lib/chat/client-chat-sessions";
import { dedupeMessagesForDisplay } from "@/lib/chat/message-dedupe";
import { createClientLogger } from "@/lib/client-diagnostics";

import { isScreenReadIntent } from "@/lib/screen-intent";
import {
  DEFAULT_DESKTOP_WORKSPACE_SCOPE,
  normalizeDesktopWorkspaceScope,
  loadStoredChatPermissionMode,
  saveStoredChatPermissionMode,
  type ChatPermissionMode,
  type DesktopWorkspaceScope,
} from "@/lib/chat/permissions";
import { MariaProgressIndicator } from "@/components/maria/progress-indicator";

interface ChatContainerProps {
  chatId?: string;
  projectId?: string | null;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    parts: UIMessage["parts"];
    metadata?: UIMessage["metadata"];
  }>;
  aiModel?: ChatModelTier;
}

type ChatMessage = PersistentChatMessage;
type PendingOutgoingMessage = {
  text: string;
  files: File[];
  screenCaptureAttempted?: boolean;
};

const log = createClientLogger("ChatContainer");

const AUTO_SCROLL_THRESHOLD_PX = 24;
const AUTOMATIC_THINKING_MODE = false;
const ACTIVE_DESKTOP_WORKFLOW_STATES = new Set([
  "pending-approval",
  "running",
  "paused",
]);
const FINAL_DESKTOP_WORKFLOW_STATES = new Set([
  "completed",
  "failed",
  "stopped",
  "rejected",
]);
const FINAL_BROWSER_TASK_STATUSES = new Set([
  "completed",
  "success",
  "ready",
  "found",
  "failed",
  "timeout",
  "setup_error",
  "stopped",
]);
const PRODUCT_BUILD_EVIDENCE_PATTERN =
  /\b(?:make|build|create|design|ship|clone|recreate|turn|convert)\b[\s\S]{0,80}\b(?:product|app|website|page|landing\s+page|dashboard|flow|feature|tool|spec|prd|implementation)\b|\bbuild-ready product brief\b|\bfirst implementation steps\b/i;

type DesktopWorkspaceBridge = {
  getScope?: () => Promise<DesktopWorkspaceScope>;
  setScope?: (
    scope: DesktopWorkspaceScope
  ) => Promise<DesktopWorkspaceScope>;
  pickFolder?: () => Promise<DesktopWorkspaceScope>;
};

function getDesktopWorkspaceBridge() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window as Window & {
      electron?: {
        workspace?: DesktopWorkspaceBridge;
      };
    }
  ).electron?.workspace;
}

function getDesktopCapabilitiesBridge() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window as Window & {
      electron?: {
        getCapabilities?: () => Promise<{ platform?: string | null }>;
      };
    }
  ).electron?.getCapabilities;
}


function isTextPart(part: UIMessage["parts"][number]): part is Extract<
  UIMessage["parts"][number],
  { type: "text" }
> {
  return part.type === "text" && typeof part.text === "string";
}

function getMessageContent(message: ChatMessage): string {
  return (message.parts ?? [])
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n");
}

function getMessageTokenUsage(
  message: ChatMessage
): ChatTokenUsageMetadata | null {
  const metadata = asRecord(message.metadata);
  const tokenUsage = metadata?.tokenUsage;

  return isChatTokenUsageMetadata(tokenUsage) ? tokenUsage : null;
}

function getMessageDurationMs(
  message: ChatMessage
): number | null {
  const metadata = asRecord(message.metadata);
  if (!metadata) {
    return null;
  }

  if (
    typeof metadata.traceDurationMs === "number" &&
    Number.isFinite(metadata.traceDurationMs) &&
    metadata.traceDurationMs > 0
  ) {
    return Math.round(metadata.traceDurationMs);
  }

  const startedAt =
    typeof metadata.traceStartedAt === "string"
      ? Date.parse(metadata.traceStartedAt)
      : null;
  const finishedAt =
    typeof metadata.traceFinishedAt === "string"
      ? Date.parse(metadata.traceFinishedAt)
      : null;

  if (
    startedAt !== null &&
    finishedAt !== null &&
    !Number.isNaN(startedAt) &&
    !Number.isNaN(finishedAt) &&
    finishedAt >= startedAt
  ) {
    return finishedAt - startedAt;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function extractReasoningAndContent(text: string): { reasoning: string | null; content: string } {
  const startTagRegex = /<(?:reasoning|thought|think|thinking)\b[^>]*>/i;
  const endTagRegex = /<\/(?:reasoning|thought|think|thinking)>/i;
  
  const startMatch = text.match(startTagRegex);
  if (!startMatch) {
    return { reasoning: null, content: text };
  }
  
  const startIndex = startMatch.index!;
  const startTagLength = startMatch[0].length;
  
  const endMatch = text.match(endTagRegex);
  if (endMatch) {
    const endIndex = endMatch.index!;
    const endTagLength = endMatch[0].length;
    
    const reasoning = text.slice(startIndex + startTagLength, endIndex).trim();
    const content = (text.slice(0, startIndex) + text.slice(endIndex + endTagLength)).trim();
    return { reasoning, content };
  } else {
    // Open-ended (still streaming)
    const reasoning = text.slice(startIndex + startTagLength).trim();
    const content = text.slice(0, startIndex).trim();
    return { reasoning, content };
  }
}

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

type DynamicToolOutputSubmitter = (args: {
  tool: string;
  toolCallId: string;
  output: unknown;
}) => void | PromiseLike<void>;

function getActiveDesktopWorkflowStateId(value: unknown) {
  const state = asRecord(value);
  if (!state || typeof state.state !== "string") {
    return null;
  }

  if (!ACTIVE_DESKTOP_WORKFLOW_STATES.has(state.state)) {
    return null;
  }

  return firstNonEmptyString(state.workflowId, state.sessionId);
}

function getDesktopWorkflowStateId(value: unknown) {
  const state = asRecord(value);
  if (!state) {
    return null;
  }

  return firstNonEmptyString(state.workflowId, state.sessionId);
}

function stringifyDesktopWorkflowResult(result: unknown) {
  if (typeof result === "string") {
    return result.trim();
  }

  const record = asRecord(result);
  if (record) {
    const stdout = firstNonEmptyString(record.stdout);
    const stderr = firstNonEmptyString(record.stderr);
    const exitCode =
      typeof record.exitCode === "number" ? `exit ${record.exitCode}` : null;
    return [exitCode, stdout, stderr ? `stderr: ${stderr}` : null]
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (result == null) {
    return "";
  }

  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function truncateWorkflowEvidence(value: string, limit = 1200) {
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 3)}...` : trimmed;
}

function formatDesktopWorkspaceScopeForPrompt(scope?: DesktopWorkspaceScope | null) {
  if (!scope?.path?.trim()) {
    return "";
  }

  const mode =
    scope.mode === "bypass"
      ? "bypass desktop access"
      : scope.mode === "full-access"
        ? "full desktop access"
        : "scoped folder access";

  return `Desktop workspace target: ${scope.path.trim()} (${mode}).`;
}

function buildDesktopWorkflowEvidencePrompt(
  value: unknown,
  workspaceScope?: DesktopWorkspaceScope | null
) {
  const state = asRecord(value);
  const workflowId = getDesktopWorkflowStateId(value);
  const status = firstNonEmptyString(state?.state);
  if (!state || !workflowId || !status || !FINAL_DESKTOP_WORKFLOW_STATES.has(status)) {
    return null;
  }

  const logs = Array.isArray(state.logs) ? state.logs : [];
  const evidence = logs
    .map((item, index) => {
      const log = asRecord(item);
      if (!log || log.status !== "completed" || log.result == null) {
        return null;
      }

      const output = stringifyDesktopWorkflowResult(log.result);
      if (!output) {
        return null;
      }

      const title =
        firstNonEmptyString(log.stepName, log.action, log.stepId) ??
        `Step ${index + 1}`;
      return `- ${title}: ${truncateWorkflowEvidence(output, 700)}`;
    })
    .filter(Boolean)
    .slice(-5)
    .join("\n");

  const screenshotNote =
    normalizeScreenshotDataUrl(state.screenshotDataUrl)
      ? "A desktop screenshot was captured and is visible in the workflow card."
      : "";
  const error = firstNonEmptyString(state.error);
  const task = firstNonEmptyString(state.task, state.description) ?? "Desktop workflow";
  const workspaceScopeNote = formatDesktopWorkspaceScopeForPrompt(workspaceScope);

  if (!evidence && !screenshotNote && !error) {
    return null;
  }

  const isScreenshotOnly =
    (Boolean(state.workflow) &&
      isScreenshotOnlyDesktopWorkflow(state.workflow as DesktopWorkflow)) ||
    (logs.length === 1 &&
      asRecord(logs[0])?.action === "screenshot") ||
    ((firstNonEmptyString(state.task, state.description)?.toLowerCase().includes("screenshot") ?? false) &&
      logs.length <= 1);

  if (isScreenshotOnly) {
    return [
      `Desktop screenshot workflow ${workflowId} finished with status: ${status}.`,
      `Task: ${task}`,
      error ? `Error: ${error}` : "",
      screenshotNote,
      "Confirm the desktop screenshot was completed cleanly (for example, 'Screenshot completed'). If the user explicitly asked a question about what is visible on the screen, answer their question concisely based on the screenshot evidence. Do NOT generate approval prompts, do NOT ask for approval for unrequested workflows, and do NOT text yourself with extraneous prompts or next-step questions.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    `Desktop workflow ${workflowId} finished with status: ${status}.`,
    `Task: ${task}`,
    error ? `Error: ${error}` : "",
    workspaceScopeNote,
    screenshotNote,
    evidence ? `Evidence:\n${evidence}` : "",
    workspaceScopeNote
      ? "Summarize what Maria did, what was found, and the next useful action. If the original app/desktop task is still incomplete and the next step is clear from the screenshot or logs, prepare the next approval-gated desktop workflow with explicit safe steps instead of stopping at a summary. If a requested build or artifact step is now clear, prepare an approval-gated desktop workflow that writes, appends, or edits safe local artifacts inside the desktop workspace target using writeFile, appendToFile, replaceInFile, harmless shellCommand, and revealAfterWrite, revealAfterAppend, or revealAfterReplace where useful. If it failed or stopped, explain the blocker and the safest next step. Do NOT write text-based 'Approval Required' or 'Would you like me to proceed' prompts into assistant text; workflow cards handle user approval UI directly."
      : "Summarize what Maria did, what was found, and the next useful action. If the original app/desktop task is still incomplete and the next step is clear from the screenshot or logs, prepare the next approval-gated desktop workflow with explicit safe steps instead of stopping at a summary. If it failed or stopped, explain the blocker and the safest next step. Do NOT write text-based 'Approval Required' or 'Would you like me to proceed' prompts into assistant text; workflow cards handle user approval UI directly.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getDesktopWorkflowScreenshotDataUrl(value: unknown) {
  const state = asRecord(value);
  const dataUrl = firstNonEmptyString(state?.screenshotDataUrl);
  return normalizeScreenshotDataUrl(dataUrl);
}

function getBrowserTaskEvidenceId(value: unknown) {
  const output = asRecord(value);
  if (!output) {
    return null;
  }

  return firstNonEmptyString(output.browserSessionId, output.sessionId, output.id);
}

function getBrowserTaskScreenshotDataUrl(value: unknown) {
  const output = asRecord(value);
  const dataUrl = firstNonEmptyString(output?.screenshotDataUrl);
  return normalizeScreenshotDataUrl(dataUrl);
}

function getBrowserEvidenceLog(value: unknown) {
  const output = asRecord(value);
  const actionLog = Array.isArray(output?.actionLog) ? output.actionLog : [];
  const evidence = actionLog
    .map((item, index) => {
      const entry = asRecord(item);
      if (!entry) {
        return null;
      }

      const action = firstNonEmptyString(entry.action) || `Action ${index + 1}`;
      const status = firstNonEmptyString(entry.status) || "info";
      const message = firstNonEmptyString(entry.message);
      if (!message) {
        return null;
      }

      return `- [${status}] ${action}: ${truncateWorkflowEvidence(message, 500)}`;
    })
    .filter((item): item is string => Boolean(item))
    .slice(-8)
    .join("\n");

  return evidence;
}

const TERMINAL_BROWSER_SESSION_STATUSES = new Set([
  "completed",
  "finished",
  "done",
  "failed",
  "error",
  "stopped",
  "closed",
  "setup_error",
]);

function buildBrowserTaskEvidencePrompt(
  value: unknown,
  _workspaceScope?: DesktopWorkspaceScope | null
) {
  const session = asRecord(value);
  if (!session) {
    return null;
  }

  const rawStatus = firstNonEmptyString(session.status)?.toLowerCase();
  const isExited = session.exitCode != null || session.exitedAt != null;
  const isTerminal = (rawStatus && TERMINAL_BROWSER_SESSION_STATUSES.has(rawStatus)) || isExited;

  if (!isTerminal) {
    return null;
  }

  const taskId = getBrowserTaskEvidenceId(session) ?? "browser_task";
  const task = firstNonEmptyString(session.task) ?? "Browser task";
  const summary = firstNonEmptyString(session.summary);
  const currentUrl = firstNonEmptyString(session.currentUrl);
  const title = firstNonEmptyString(session.title);
  const setupError = firstNonEmptyString(session.setupError);
  const evidenceLog = getBrowserEvidenceLog(session);
  const screenshotDataUrl = getBrowserTaskScreenshotDataUrl(session);

  return [
    `Browser task ${taskId} finished with status: ${rawStatus || "completed"}.`,
    `Task: ${task}`,
    title ? `Page Title: ${title}` : null,
    currentUrl ? `Current URL: ${currentUrl}` : null,
    summary ? `Summary: ${summary}` : null,
    setupError ? `Error: ${setupError}` : null,
    evidenceLog ? `Execution Log:\n${evidenceLog}` : null,
    screenshotDataUrl ? `A browser screenshot was captured and is attached.` : null,
    "Report the outcome of the browser task to the user. Summarize what was accomplished, what was found, and answer the user's request based on this evidence. Keep the response clear and concise."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function isDesktopWorkflow(value: unknown): value is DesktopWorkflow {
  const workflow = asRecord(value);
  if (!workflow) {
    return false;
  }

  return (
    typeof workflow.id === "string" &&
    typeof workflow.name === "string" &&
    typeof workflow.source === "string" &&
    typeof workflow.requiresApproval === "boolean" &&
    Array.isArray(workflow.steps)
  );
}

function isScreenshotOnlyDesktopWorkflow(workflow: DesktopWorkflow) {
  return (
    workflow.source === "chat-tool" &&
    workflow.steps.length === 1 &&
    asRecord(workflow.steps[0]?.action)?.type === "screenshot"
  );
}

function normalizeDesktopWorkflowForHandoff(workflow: DesktopWorkflow) {
  return isScreenshotOnlyDesktopWorkflow(workflow)
    ? { ...workflow, requiresApproval: false }
    : workflow;
}

function getDesktopWorkflowFromPart(part: UIMessage["parts"][number]) {
  const record = asRecord(part);
  if (!record || typeof record.type !== "string") {
    return null;
  }

  const toolName =
    typeof record.toolName === "string"
      ? record.toolName
      : record.type.startsWith("tool-")
        ? record.type.replace("tool-", "")
        : null;

  if (toolName !== "planWorkflow" && toolName !== "executeWorkflow") {
    return null;
  }

  const output = asRecord(record.output) ?? asRecord(record.result);
  if (!output) {
    return null;
  }

  return isDesktopWorkflow(output.workflow)
    ? normalizeDesktopWorkflowForHandoff(output.workflow)
    : null;
}

function getDesktopWorkflowHandoffs(messages: ChatMessage[]) {
  const workflows: DesktopWorkflow[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const workflow = getDesktopWorkflowFromPart(part);
      if (!workflow || seen.has(workflow.id)) {
        continue;
      }

      seen.add(workflow.id);
      workflows.push(workflow);
    }
  }

  return workflows;
}

function getSummarizedDesktopWorkflowIdsFromMessages(messages: ChatMessage[]) {
  const set = new Set<string>();
  for (const message of messages) {
    const text = getMessageContent(message);
    if (text) {
      for (const match of text.matchAll(/Desktop (?:screenshot )?workflow ([a-zA-Z0-9_-]+) finished with status:/g)) {
        if (match[1]) {
          set.add(match[1]);
        }
      }
    }
  }
  return set;
}

function getSummarizedBrowserTaskIdsFromMessages(messages: ChatMessage[]) {
  const set = new Set<string>();
  for (const message of messages) {
    const text = getMessageContent(message);
    if (text) {
      for (const match of text.matchAll(/Browser workflow ([a-zA-Z0-9_-]+) finished with status:/g)) {
        if (match[1]) {
          set.add(match[1]);
        }
      }
    }
  }
  return set;
}


function formatChatErrorMessage(message: unknown) {
  if (typeof message !== "string") {
    return "The AI service did not return a response.";
  }

  // Try to parse JSON error bodies like { error: "..." }
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed.error === "string") {
      return parsed.error;
    }
    if (parsed && typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    // not JSON, continue
  }

  // If the server accidentally returned HTML (framework error pages), try to
  // extract a useful title or heading before falling back to a generic message.
  const titleMatch = message.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  const h1Match = message.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    return h1Match[1].trim();
  }

  const cleaned = message.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "The AI service did not return a response.";
  }

  if (/<!doctype html|<html|<head|<body/i.test(message)) {
    return "The chat request failed before the AI response could stream. Please retry.";
  }

  return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
}



function getSavedMemoryIds(messages: ChatMessage[]) {
  const savedIds: string[] = [];

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const record = asRecord(part);
      if (!record) {
        continue;
      }

      if (record.toolName !== "saveMemory") {
        continue;
      }

      const output = asRecord(record.output);

      if (!output || output.saved !== true) {
        continue;
      }

      if (typeof output.id === "string") {
        savedIds.push(output.id);
      } else if (typeof record.toolCallId === "string") {
        savedIds.push(record.toolCallId);
      }
    }
  }

  return savedIds;
}

function getLatestResolvedChatId(messages: ChatMessage[]) {
  const latestMessageWithChatId = [...messages]
    .reverse()
    .find((message) => {
      const metadata = message.metadata as { chatId?: unknown } | undefined;
      return typeof metadata?.chatId === "string";
    });

  const metadata = latestMessageWithChatId?.metadata as
    | { chatId?: unknown }
    | undefined;

  return typeof metadata?.chatId === "string" ? metadata.chatId : null;
}

function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();

  for (const file of files) {
    dataTransfer.items.add(file);
  }

  return dataTransfer.files;
}

function hasImageFile(files: File[]) {
  return files.some((file) => isSafeGeneratedMediaMimeType(file.type, "image"));
}

function dataUrlToFile(dataUrl: string | null | undefined, fileName: string) {
  const normalizedDataUrl = normalizeScreenshotDataUrl(dataUrl);

  if (!normalizedDataUrl) {
    return null;
  }

  const match = normalizedDataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1] || "image/png";
  const isBase64 = match[2] === ";base64";
  const payload = match[3] || "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

async function captureScreenFileForChat() {
  const captureScreen = window.electron?.system?.captureScreen;
  if (typeof captureScreen !== "function") {
    return null;
  }

  const dataUrl = await captureScreen();
  return dataUrlToFile(
    dataUrl,
    `rearvy-screen-${new Date().toISOString().replace(/[:.]/g, "-")}.png`
  );
}

async function attachScreenCaptureIfRequested(
  message: PendingOutgoingMessage
): Promise<PendingOutgoingMessage> {
  const trimmedText = message.text.trim();
  if (
    message.screenCaptureAttempted ||
    !trimmedText ||
    !isScreenReadIntent(trimmedText) ||
    hasImageFile(message.files)
  ) {
    return message;
  }

  if (typeof window === "undefined" || !window.electron) {
    toast.error("Screen reading requires the Rearvy desktop app.");
    return { ...message, screenCaptureAttempted: true };
  }

  if (typeof window.electron.system?.captureScreen !== "function") {
    toast.error("Direct screen capture is unavailable. Trying the Desktop Workspace fallback.");
    return { ...message, screenCaptureAttempted: true };
  }

  try {
    const screenshotFile = await captureScreenFileForChat();
    if (!screenshotFile) {
      toast.error("Screen capture returned no image. Trying the Desktop Workspace fallback.");
      return { ...message, screenCaptureAttempted: true };
    }

    return {
      ...message,
      files: [...message.files, screenshotFile],
      screenCaptureAttempted: true,
    };
  } catch (error) {
    log.error("Failed to capture screen for chat:", error);
    toast.error("Could not capture the screen. Trying the Desktop Workspace fallback.");
    return { ...message, screenCaptureAttempted: true };
  }
}

export function ChatContainer({
  chatId,
  projectId,
  initialMessages = [],
  aiModel = DEFAULT_CHAT_MODEL_TIER,
}: ChatContainerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const pendingRouteChatIdRef = useRef<string | null>(null);
  const hasRecoveredMissingChatRef = useRef(false);
  const [input, setInput] = useState("");
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [queuedMessages, setQueuedMessages] = useState<PendingOutgoingMessage[]>([]);
  const [permissionMode, setPermissionMode] =
    useState<ChatPermissionMode>(loadStoredChatPermissionMode);
  const [selectedModel, setSelectedModel] = useState<ChatModelTier>(
    aiModel || DEFAULT_CHAT_MODEL_TIER
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("max");
  const [modelSpeed, setModelSpeed] = useState<ModelSpeed>("standard");
  const thinkingMode =
    selectedModel === "rearvy-expert-2.7" ||
    reasoningEffort === "high" ||
    reasoningEffort === "extra-high" ||
    reasoningEffort === "max" ||
    reasoningEffort === "ultra";
  const [desktopScope, setDesktopScope] =
    useState<DesktopWorkspaceScope>(DEFAULT_DESKTOP_WORKSPACE_SCOPE);
  const [desktopPlatform, setDesktopPlatform] = useState<string | null>(null);
  const { user } = useAuth();
  const messagesRef = useRef<ChatMessage[]>(initialMessages as ChatMessage[]);
  const seenMemorySaveIdsRef = useRef<Set<string>>(new Set());
  const emptyTurnRecoveryAttemptedRef = useRef<Set<string>>(new Set());
  const queuedMessagesRef = useRef<PendingOutgoingMessage[]>([]);
  const startedDesktopWorkflowIdsRef = useRef<Set<string>>(
    new Set(
      getDesktopWorkflowHandoffs(initialMessages as ChatMessage[]).map(
        (workflow) => workflow.id
      )
    )
  );
  const summarizedDesktopWorkflowIdsRef = useRef<Set<string>>(
    getSummarizedDesktopWorkflowIdsFromMessages(initialMessages as ChatMessage[])
  );
  const summarizedBrowserTaskIdsRef = useRef<Set<string>>(
    getSummarizedBrowserTaskIdsFromMessages(initialMessages as ChatMessage[])
  );
  const activeDesktopWorkflowIdRef = useRef<string | null>(null);
  const [isBrowserPaneOpen, setIsBrowserPaneOpen] = useState(false);
  const [hasActiveDesktopWorkflow, setHasActiveDesktopWorkflow] = useState(false);
  const [isDesktopWorkspaceOpen, setIsDesktopWorkspaceOpen] = useState(false);
  const [isBrowserDriving, setIsBrowserDriving] = useState(false);
  const [browserDriveStep, setBrowserDriveStep] = useState<string | null>(null);
  const [isBrowserChipExpanded, setIsBrowserChipExpanded] = useState(true);
  const browserWorkspaceStorageKey = BROWSER_WORKSPACE_PREFERENCE_KEY;
  const effectiveModel = selectedModel;

  const handlePermissionModeChange = useCallback(
    (newMode: ChatPermissionMode) => {
      setPermissionMode(newMode);
      saveStoredChatPermissionMode(newMode);

      const workspace = getDesktopWorkspaceBridge();
      if (workspace?.setScope) {
        void workspace
          .setScope({
            mode: newMode === "full-access" ? "full-access" : "folder",
            path: desktopScope.path || "",
          })
          .catch((error) => {
            log.warn("Failed to sync scope mode to desktop workspace:", error);
          });
      }
    },
    [desktopScope.path]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedMode = loadStoredChatPermissionMode();
    setPermissionMode(storedMode);

    const workspace = getDesktopWorkspaceBridge();
    const getCapabilities = getDesktopCapabilitiesBridge();
    if (!workspace?.getScope) {
      setDesktopPlatform(null);
      return;
    }

    let isActive = true;

    void Promise.allSettled([
      workspace.getScope(),
      getCapabilities ? getCapabilities() : Promise.resolve(null),
    ])
      .then(([scopeResult, capabilitiesResult]) => {
        if (!isActive) {
          return;
        }

        if (scopeResult.status === "fulfilled") {
          const normalizedScope = normalizeDesktopWorkspaceScope(scopeResult.value);
          setDesktopScope(normalizedScope);
        } else {
          log.warn("Failed to read desktop workspace scope:", scopeResult.reason);
        }

        if (capabilitiesResult.status === "fulfilled") {
          const platform =
            typeof capabilitiesResult.value?.platform === "string" &&
            capabilitiesResult.value.platform.trim()
              ? capabilitiesResult.value.platform.trim().toLowerCase()
              : null;
          setDesktopPlatform(platform);
        } else {
          log.warn("Failed to read desktop capabilities:", capabilitiesResult.reason);
          setDesktopPlatform(null);
        }
      })
      .catch((error) => {
        log.warn("Failed to read desktop workspace context:", error);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setActiveChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (user) {
      const freshToken = await getIdToken();
      if (freshToken) {
        return { Authorization: `Bearer ${freshToken}` };
      }
    }

    return {} as Record<string, string>;
  }, [user]);

  const handlePickWorkspaceFolder = useCallback(async () => {
    const workspace = getDesktopWorkspaceBridge();
    if (!workspace?.pickFolder) {
      toast.error("Folder scope is available only in the Rearvy desktop app.");
      return;
    }

    try {
      const nextScope = normalizeDesktopWorkspaceScope(
        await workspace.pickFolder()
      );
      setDesktopScope(nextScope);
      const nextMode =
        nextScope.mode === "bypass" ? "bypass" : "full-access";
      setPermissionMode(nextMode);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to choose a workspace folder."
      );
    }
  }, []);

  const sessionKey = useMemo(
    () => getChatSessionKey({ chatId, projectId }),
    [chatId, projectId]
  );


  const chatSession = useMemo(
    () =>
      getOrCreateChatClientSession({
        key: sessionKey,
        chatId: chatId ?? null,
        projectId: projectId ?? null,
        aiModel: effectiveModel,
        chatPermissionMode: permissionMode,
        thinkingMode,
        desktopPlatform,
        getHeaders: getAuthHeaders,
        initialMessages: initialMessages as PersistentChatMessage[],
      }),
    [
      chatId,
      effectiveModel,
      getAuthHeaders,
      thinkingMode,
      desktopPlatform,
      projectId,
      sessionKey,
    ]
  );

  useEffect(() => {
    hydrateChatClientSessionMessages(
      sessionKey,
      initialMessages as PersistentChatMessage[]
    );
  }, [initialMessages, sessionKey]);

  useEffect(() => {
    updateChatClientSessionRequest(sessionKey, {
      chatId: activeChatId ?? chatId ?? null,
      projectId: projectId ?? null,
      aiModel: effectiveModel,
      chatPermissionMode: permissionMode,
      thinkingMode,
      desktopPlatform,
      getHeaders: getAuthHeaders,
    });
  }, [
    activeChatId,
    chatId,
    effectiveModel,
    getAuthHeaders,
    permissionMode,
    thinkingMode,
    desktopPlatform,
    projectId,
    sessionKey,
  ]);

  const buildRouteHandoffMessages = useCallback(
    (finalAssistantMessage?: ChatMessage): ChatRouteMessage[] => {
      const snapshot = [...messagesRef.current];

      if (finalAssistantMessage) {
        const existingIndex = snapshot.findIndex(
          (message) => message.id === finalAssistantMessage.id
        );

        if (existingIndex >= 0) {
          snapshot[existingIndex] = finalAssistantMessage;
        } else {
          snapshot.push(finalAssistantMessage);
        }
      }

      return snapshot
        .filter(
          (
            message
          ): message is ChatMessage & { role: "user" | "assistant" } =>
            (message.role === "user" || message.role === "assistant") &&
            Array.isArray(message.parts)
        )
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: getMessageContent(message),
          parts: message.parts as UIMessage["parts"],
          metadata: message.metadata as PersistentChatMessage["metadata"] | undefined,
        }));
    },
    []
  );

  const persistPendingRouteHandoff = useCallback(() => {
    const resolvedChatId =
      getLatestResolvedChatId(messagesRef.current) ??
      pendingRouteChatIdRef.current ??
      activeChatId ??
      chatId ??
      null;

    if (!resolvedChatId) {
      return;
    }

    const handoffMessages = buildRouteHandoffMessages();
    if (handoffMessages.length === 0) {
      return;
    }

    savePendingChatRouteHandoff({
      chatId: resolvedChatId,
      projectId,
      messages: handoffMessages,
    });
  }, [activeChatId, buildRouteHandoffMessages, chatId, projectId]);

  const updateAutoScrollPreference = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (isProgrammaticScrollRef.current) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.clientHeight - container.scrollTop;
    shouldAutoScrollRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    container.scrollTop = container.scrollHeight;

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    } else {
      isProgrammaticScrollRef.current = false;
    }
  }, []);

  const handleWheelCapture = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) {
        shouldAutoScrollRef.current = false;
        return;
      }

      updateAutoScrollPreference();
    },
    [updateAutoScrollPreference]
  );

  const navigateToChat = useCallback(
    (nextChatId: string, handoffMessages?: ChatRouteMessage[]) => {
      const targetPath = projectId
        ? `/projects/${projectId}/chat/${nextChatId}`
        : `/chat/${nextChatId}`;

      if (pathname === targetPath) {
        return;
      }

      const messagesForRoute = handoffMessages ?? buildRouteHandoffMessages();
      if (messagesForRoute.length > 0) {
        savePendingChatRouteHandoff({
          chatId: nextChatId,
          projectId,
          messages: messagesForRoute,
        });
      }

      router.replace(targetPath);
    },
    [buildRouteHandoffMessages, pathname, projectId, router]
  );

  const activateChatId = useCallback(
    (nextChatId: string | null, handoffMessages?: ChatRouteMessage[]) => {
      if (!nextChatId) {
        return;
      }

      if (nextChatId !== activeChatId) {
        setActiveChatId(nextChatId);
      }

      if (queuedMessagesRef.current.length > 0) {
        pendingRouteChatIdRef.current = nextChatId;
        return;
      }

      pendingRouteChatIdRef.current = null;
      navigateToChat(nextChatId, handoffMessages);
    },
    [activeChatId, navigateToChat]
  );

  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    regenerate,
    addToolOutput,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    chat: chatSession.chat,
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const displayMessages = useMemo(
    () => dedupeMessagesForDisplay(messages),
    [messages]
  );

  const tokenUsage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== "assistant") {
        continue;
      }

      const messageTokenUsage = getMessageTokenUsage(message);
      if (messageTokenUsage) {
        return messageTokenUsage;
      }
    }

    return buildChatTokenUsageMetadata({
      providerModel: resolveChatProviderModel(effectiveModel),
      maxOutputTokens: DEFAULT_CHAT_MAX_OUTPUT_TOKENS,
    });
  }, [effectiveModel, messages]);

  const lastTurnDurationMs = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== "assistant") {
        continue;
      }

      const duration = getMessageDurationMs(message);
      if (duration !== null) {
        return duration;
      }
    }

    return null;
  }, [messages]);

  const latestBrowserToolOutput = useMemo(() => {
    const allParts = messages.flatMap((m) => m.parts ?? []);
    const browserParts = allParts.filter((p) => {
      const part = asRecord(p);
      if (!part || typeof part.type !== "string") return false;
      const type = part.type;
      if (!type.startsWith("tool-") && type !== "dynamic-tool") return false;
      const name = typeof part.toolName === "string" ? part.toolName : type.replace("tool-", "");
      return name === "runBrowserTask" || name === "controlBrowserSession";
    });
    if (browserParts.length === 0) return null;
    const lastPart = asRecord(browserParts[browserParts.length - 1]);
    return asRecord(lastPart?.output) ?? asRecord(lastPart?.result);
  }, [messages]);

  const activeBrowserSessionId =
    typeof latestBrowserToolOutput?.browserSessionId === "string"
      ? latestBrowserToolOutput.browserSessionId
      : undefined;

  useEffect(() => {
    if (!latestBrowserToolOutput) {
      return;
    }

    const evidenceId = getBrowserTaskEvidenceId(latestBrowserToolOutput);
    const evidencePrompt = buildBrowserTaskEvidencePrompt(
      latestBrowserToolOutput,
      desktopScope
    );
    if (
      !evidenceId ||
      !evidencePrompt ||
      summarizedBrowserTaskIdsRef.current.has(evidenceId)
    ) {
      return;
    }

    summarizedBrowserTaskIdsRef.current.add(evidenceId);
    const screenshotFile = dataUrlToFile(
      getBrowserTaskScreenshotDataUrl(latestBrowserToolOutput),
      `rearvy-browser-${evidenceId}.png`
    );
    void sendMessage(
      screenshotFile
        ? { text: evidencePrompt, files: createFileList([screenshotFile]) }
        : { text: evidencePrompt }
    );
  }, [desktopScope, latestBrowserToolOutput, sendMessage]);

  useEffect(() => {
    if (!activeBrowserSessionId) {
      return;
    }

    let isActive = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchBrowserSessionEvidence = async () => {
      if (summarizedBrowserTaskIdsRef.current.has(activeBrowserSessionId)) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }

      try {
        const token = await getIdToken();
        if (!isActive || !token) {
          return;
        }

        const response = await fetch(`/api/browser/sessions/${activeBrowserSessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!isActive || !response.ok) {
          return;
        }

        const session = asRecord(await response.json().catch(() => null));
        if (!session) {
          return;
        }

        const evidenceId = getBrowserTaskEvidenceId(session) ?? activeBrowserSessionId;
        const evidencePrompt = buildBrowserTaskEvidencePrompt({
          ...session,
          browserSessionId: evidenceId,
        }, desktopScope);
        if (!evidencePrompt || summarizedBrowserTaskIdsRef.current.has(evidenceId)) {
          return;
        }

        summarizedBrowserTaskIdsRef.current.add(evidenceId);
        const screenshotFile = dataUrlToFile(
          getBrowserTaskScreenshotDataUrl(session),
          `rearvy-browser-${evidenceId}.png`
        );
        void sendMessage(
          screenshotFile
            ? { text: evidencePrompt, files: createFileList([screenshotFile]) }
            : { text: evidencePrompt }
        );
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch (error) {
        log.warn("Failed to fetch browser evidence for Maria:", error);
      }
    };

    void fetchBrowserSessionEvidence();
    intervalId = setInterval(() => {
      void fetchBrowserSessionEvidence();
    }, 2500);

    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeBrowserSessionId, desktopScope, sendMessage]);

  const syncDesktopAutomationState = useCallback((nextState: unknown) => {
    const workflowId = getDesktopWorkflowStateId(nextState);
    const evidencePrompt = buildDesktopWorkflowEvidencePrompt(nextState, desktopScope);
    const isWorkflowFromThisChat = Boolean(
      workflowId && startedDesktopWorkflowIdsRef.current.has(workflowId)
    );

    if (
      workflowId &&
      evidencePrompt &&
      isWorkflowFromThisChat &&
      !summarizedDesktopWorkflowIdsRef.current.has(workflowId)
    ) {
      summarizedDesktopWorkflowIdsRef.current.add(workflowId);
      const screenshotFile = dataUrlToFile(
        getDesktopWorkflowScreenshotDataUrl(nextState),
        `rearvy-workflow-${workflowId}.png`
      );
      void sendMessage(
        screenshotFile
          ? { text: evidencePrompt, files: createFileList([screenshotFile]) }
          : { text: evidencePrompt }
      );
    }

    const activeWorkflowId = getActiveDesktopWorkflowStateId(nextState);
    const isActiveWorkflowFromThisChat = Boolean(
      activeWorkflowId && startedDesktopWorkflowIdsRef.current.has(activeWorkflowId)
    );
    setHasActiveDesktopWorkflow(isActiveWorkflowFromThisChat);

    if (!activeWorkflowId || !isActiveWorkflowFromThisChat) {
      activeDesktopWorkflowIdRef.current = null;
      return;
    }

    if (activeDesktopWorkflowIdRef.current !== activeWorkflowId) {
      activeDesktopWorkflowIdRef.current = activeWorkflowId;
      setIsDesktopWorkspaceOpen(true);
    }
  }, [desktopScope, sendMessage]);

  useEffect(() => {
    const pref = readBrowserWorkspacePreference(browserWorkspaceStorageKey);
    if (pref && latestBrowserToolOutput) {
      setIsBrowserPaneOpen(true);
    }
  }, [latestBrowserToolOutput, browserWorkspaceStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isActive = true;
    let unsubscribeStateChange: (() => void) | undefined;

    const checkAutomationBridge = () => {
      const automation = window.electron?.automation;

      unsubscribeStateChange?.();
      unsubscribeStateChange = automation?.onStateChange?.((nextState: unknown) => {
        if (isActive) {
          syncDesktopAutomationState(nextState);
        }
      });

      if (!automation?.getState) {
        syncDesktopAutomationState(null);
        return;
      }

      void automation
        .getState()
        .then((nextState) => {
          if (isActive) {
            syncDesktopAutomationState(nextState);
          }
        })
        .catch((error) => {
          log.warn("Failed to read desktop automation state:", error);
        });
    };

    checkAutomationBridge();
    window.addEventListener("rearvy-electron-ready", checkAutomationBridge as EventListener);
    window.addEventListener("focus", checkAutomationBridge);

    return () => {
      isActive = false;
      unsubscribeStateChange?.();
      window.removeEventListener("rearvy-electron-ready", checkAutomationBridge as EventListener);
      window.removeEventListener("focus", checkAutomationBridge);
    };
  }, [syncDesktopAutomationState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const automation = window.electron?.automation;
    if (!automation?.startWorkflow) {
      return;
    }

    const workflows = getDesktopWorkflowHandoffs(messages);
    if (workflows.length === 0) {
      return;
    }

    for (const workflow of workflows) {
      if (startedDesktopWorkflowIdsRef.current.has(workflow.id)) {
        continue;
      }

      startedDesktopWorkflowIdsRef.current.add(workflow.id);
      activeDesktopWorkflowIdRef.current = workflow.id;
      setHasActiveDesktopWorkflow(true);
      setIsDesktopWorkspaceOpen(true);

      void automation.startWorkflow(workflow)
        .then((result) => {
          if (result?.state) {
            syncDesktopAutomationState(result.state);
          }

          if (result?.success === false || result?.ok === false) {
            const errorMessage: string = result.error || result.reason || "";

            // If the executor wasn't ready yet (e.g. bridge still initialising),
            // un-track this workflow ID so the effect can retry it the next time
            // the bridge fires rearvy-electron-ready or messages change.
            const isExecutorNotReady =
              errorMessage.toLowerCase().includes("executor not initialized") ||
              errorMessage.toLowerCase().includes("not initialized");

            if (isExecutorNotReady) {
              startedDesktopWorkflowIdsRef.current.delete(workflow.id);
              // Don't toast — the retry will happen silently on reconnect.
              return;
            }

            if (!result.state) {
              syncDesktopAutomationState(null);
            }
            toast.error(errorMessage || "Desktop workflow could not be started.");
            return;
          }

          toast.success(
            workflow.requiresApproval
              ? `${workflow.name} is ready for approval.`
              : `${workflow.name} started.`
          );
        })
        .catch((error) => {
          // On a hard IPC failure (bridge crash, Electron not available) also
          // un-track so the next bridge-ready event will retry.
          startedDesktopWorkflowIdsRef.current.delete(workflow.id);
          syncDesktopAutomationState(null);
          toast.error(error instanceof Error ? error.message : String(error));
        });
    }
  }, [messages, syncDesktopAutomationState]);


  useEffect(() => {
    if (!error) {
      hasRecoveredMissingChatRef.current = false;
      return;
    }

    const errorMessage = error.message.toLowerCase();
    if (!errorMessage.includes("chat not found")) {
      return;
    }

    if (hasRecoveredMissingChatRef.current) {
      return;
    }

    hasRecoveredMissingChatRef.current = true;
    persistPendingRouteHandoff();
    setActiveChatId(undefined);

    const fallbackPath = projectId
      ? `/projects/${projectId}`
      : `/chat/new?fresh=${Date.now()}`;
    router.replace(fallbackPath);
  }, [error, persistPendingRouteHandoff, projectId, router]);

  useEffect(() => {
    return () => {
      if (status !== "submitted" && status !== "streaming") {
        return;
      }

      persistPendingRouteHandoff();
    };
  }, [persistPendingRouteHandoff, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeUnload = () => {
      if (status !== "submitted" && status !== "streaming") {
        return;
      }

      persistPendingRouteHandoff();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [persistPendingRouteHandoff, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let shouldNotify = false;
    for (const id of getSavedMemoryIds(messages)) {
      if (seenMemorySaveIdsRef.current.has(id)) {
        continue;
      }

      seenMemorySaveIdsRef.current.add(id);
      shouldNotify = true;
    }

    if (shouldNotify) {
      window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
    }
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let shouldNotify = false;
    for (const message of messages) {
      const metadata = message.metadata as
        | { autoSavedMemoryId?: unknown }
        | undefined;

      if (typeof metadata?.autoSavedMemoryId !== "string") {
        continue;
      }

      if (seenMemorySaveIdsRef.current.has(metadata.autoSavedMemoryId)) {
        continue;
      }

      seenMemorySaveIdsRef.current.add(metadata.autoSavedMemoryId);
      shouldNotify = true;
    }

    if (shouldNotify) {
      window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
    }
  }, [messages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Track browser drive loop state via CustomEvents dispatched by BrowserLiveViewer
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleDriveStep = (event: Event) => {
      const detail = (event as CustomEvent<{ status: string; action?: string }>).detail;
      if (!detail) return;

      if (detail.status === "running" || detail.status === "approval_required") {
        setIsBrowserDriving(true);
        setBrowserDriveStep(detail.action ?? "Working on browser");
      } else if (detail.status === "done") {
        setIsBrowserDriving(false);
        setBrowserDriveStep(null);
      }
    };

    window.addEventListener("rearvy:browser-drive-step", handleDriveStep);
    return () => window.removeEventListener("rearvy:browser-drive-step", handleDriveStep);
  }, []);

  // When browser session goes away (new task), reset drive state
  useEffect(() => {
    if (!activeBrowserSessionId) {
      setIsBrowserDriving(false);
      setBrowserDriveStep(null);
    }
  }, [activeBrowserSessionId]);

  const effectiveIsLoading = isLoading || isBrowserDriving;

  const handleToolOutput = useCallback(
    async (params: { tool: string; toolCallId: string; output: unknown }) => {
      const submitToolOutput = addToolOutput as DynamicToolOutputSubmitter;
      await submitToolOutput({
        tool: params.tool,
        toolCallId: params.toolCallId,
        output: params.output,
      });
    },
    [addToolOutput]
  );

  const handleToolApprovalResponse = useCallback(
    async (params: { id: string; approved: boolean; reason?: string }) => {
      await addToolApprovalResponse(params);
    },
    [addToolApprovalResponse]
  );

  const dispatchMessage = useCallback(
    async (message: PendingOutgoingMessage) => {
      const preparedMessage = await attachScreenCaptureIfRequested(message);
      const trimmedText = preparedMessage.text.trim();
      const outgoingFiles = preparedMessage.files;

      const hasFiles = outgoingFiles.length > 0;
      const files = hasFiles ? createFileList(outgoingFiles) : null;

      shouldAutoScrollRef.current = true;

      if (files && trimmedText) {
        sendMessage({
          text: trimmedText,
          files,
        });
        return;
      }

      if (files) {
        sendMessage({
          files,
        });
        return;
      }

      sendMessage({
        text: trimmedText,
      });
    },
    [sendMessage]
  );

  useEffect(() => {
    const nextChatId = getLatestResolvedChatId(messages);
    if (!nextChatId) {
      return;
    }

    if (nextChatId && !chatId) {
      const targetSessionKey = getChatSessionKey({
        chatId: nextChatId,
        projectId: projectId ?? null,
      });

      promoteChatClientSession({
        fromKey: sessionKey,
        toKey: targetSessionKey,
        chatId: nextChatId,
        projectId: projectId ?? null,
        aiModel: effectiveModel,
        chatPermissionMode: permissionMode,
        thinkingMode,
        desktopPlatform,
        getHeaders: getAuthHeaders,
      });
    }

    activateChatId(nextChatId);
  }, [
    activateChatId,
    chatId,
    effectiveModel,
    getAuthHeaders,
    messages,
    permissionMode,
    thinkingMode,
    desktopPlatform,
    projectId,
    sessionKey,
  ]);

  useEffect(() => {
    if (isLoading || queuedMessages.length === 0) {
      return;
    }

    const [nextMessage] = queuedMessages;
    if (!nextMessage) {
      return;
    }

    setQueuedMessages((currentQueue) => currentQueue.slice(1));
    void dispatchMessage(nextMessage);
  }, [dispatchMessage, isLoading, queuedMessages]);

  useEffect(() => {
    if (isLoading || queuedMessages.length > 0) {
      return;
    }

    const pendingRouteChatId = pendingRouteChatIdRef.current;
    if (!pendingRouteChatId) {
      return;
    }

    pendingRouteChatIdRef.current = null;
    navigateToChat(pendingRouteChatId);
  }, [isLoading, navigateToChat, queuedMessages.length]);

  useEffect(() => {
    if (isLoading || error || queuedMessages.length > 0 || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return;
    }

    const recoveryKey = lastMessage.id || "latest-user-message";
    if (emptyTurnRecoveryAttemptedRef.current.has(recoveryKey)) {
      return;
    }

    emptyTurnRecoveryAttemptedRef.current.add(recoveryKey);
    log.warn("Detected empty assistant turn; retrying once", {
      messageId: lastMessage.id,
      chatId: activeChatId ?? chatId ?? null,
    });
    regenerate();
  }, [
    activeChatId,
    chatId,
    error,
    isLoading,
    messages,
    queuedMessages.length,
    regenerate,
  ]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (messages.length === 0) {
      container.scrollTop = 0;
      shouldAutoScrollRef.current = true;
      return;
    }

    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [activeChatId]);

  const handleSend = useCallback(
    async (text: string, files?: File[]) => {
      const trimmedText = text.trim();
      const normalizedFiles = files?.length ? files : [];
      const hasFiles = normalizedFiles.length > 0;
      if (!trimmedText && !hasFiles) return;

      const nextMessage = await attachScreenCaptureIfRequested({
        text: trimmedText,
        files: normalizedFiles,
      });

      if (isLoading) {
        setQueuedMessages((currentQueue) => [...currentQueue, nextMessage]);
        setInput("");
        return;
      }

      void dispatchMessage(nextMessage);
      setInput("");
    },
    [dispatchMessage, isLoading]
  );


  const handleTemplateClick = (prompt: string) => {
    handleSend(prompt);
  };

  const resolvedMessageChatId = activeChatId ?? chatId;

  return (
    <>
      {/* Fixed top banner shown when Rearvy is autonomously controlling the desktop or browser */}
      <ComputerUseBanner
        isDesktopActive={hasActiveDesktopWorkflow}
        isBrowserActive={isBrowserDriving}
        stepLabel={isBrowserDriving ? browserDriveStep : null}
        onStop={stop}
      />

      <div
        className={
          "flex flex-1 min-h-0 flex-col overflow-hidden lg:flex-row"
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Messages */}
          <div
            ref={scrollRef}
            onWheelCapture={handleWheelCapture}
            onScroll={updateAutoScrollPreference}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-3 pb-10 pt-8 sm:px-6 sm:pt-10 lg:px-8 xl:px-10">
              {latestBrowserToolOutput && !isBrowserPaneOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Image
                        src="/favicon.png?v=20260529a"
                        alt="Rearvy"
                        width={16}
                        height={16}
                        className="h-4 w-4 rounded object-cover"
                      />
                      <span>App browser activity is available</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      View the browser stream Rearvy used for this workflow.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsBrowserPaneOpen(true);
                      writeBrowserWorkspacePreference(
                        browserWorkspaceStorageKey,
                        true
                      );
                    }}
                  >
                    Show activity
                  </Button>
                </div>
              ) : null}

              {hasActiveDesktopWorkflow && !isDesktopWorkspaceOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-violet-500/30 bg-violet-500/10 px-4 py-3 shadow-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Monitor className="h-4 w-4 text-violet-400" />
                      <span>Desktop workspace is hidden</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reopen the live desktop automation stream when you need it.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDesktopWorkspaceOpen(true)}
                  >
                    Show desktop workspace
                  </Button>
                </div>
              ) : null}

              {error && (
                <div className="rounded-[8px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Chat request failed</p>
                      <p className="mt-1 break-words text-red-200/90">
                        {formatChatErrorMessage(error.message)}
                      </p>
                      <button
                        type="button"
                        onClick={() => regenerate()}
                        className="mt-2 text-xs font-medium underline underline-offset-2 hover:text-white"
                      >
                        Retry last message
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {messages.length === 0 ? (
                <ChatTemplates
                  onSelect={handleTemplateClick}
                />
              ) : (
                displayMessages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    isLoading={isLoading && message.id === messages[messages.length - 1]?.id}
                    chatId={resolvedMessageChatId}
                    browserCardMode={latestBrowserToolOutput && isBrowserPaneOpen ? "details" : "full"}
                    onToolOutput={handleToolOutput}
                    onToolApprovalResponse={handleToolApprovalResponse}
                  />
                ))
              )}

              {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
                <MessageBubble
                  key="pending-assistant"
                  message={{ id: "pending", role: "assistant" } as ChatMessage}
                  isLoading={true}
                  chatId={resolvedMessageChatId}
                  browserCardMode={latestBrowserToolOutput && isBrowserPaneOpen ? "details" : "full"}
                  onToolOutput={handleToolOutput}
                  onToolApprovalResponse={handleToolApprovalResponse}
                />
              )}

              {(isLoading || isBrowserDriving) && (
                <div className="flex flex-col gap-2 rounded-[8px] border border-border/60 bg-card/70 p-3.5 shadow-sm backdrop-blur-sm">
                  {/* Standard AI processing row */}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span>Processing</span>
                      {(() => {
                        const lastMessage = messages[messages.length - 1];
                        if (!lastMessage?.parts) return null;
                        const lastPart = lastMessage.parts[lastMessage.parts.length - 1];
                        const part = asRecord(lastPart);
                        if (part?.type === "tool-call" && typeof part.toolName === "string") {
                          return <span className="text-muted-foreground text-xs font-normal">— Using {part.toolName}</span>;
                        }
                        if (part?.type === "tool-result" && typeof part.toolName === "string") {
                          return <span className="text-muted-foreground text-xs font-normal">— {part.toolName} completed</span>;
                        }
                        return <span className="text-muted-foreground text-xs font-normal">— Thinking...</span>;
                      })()}
                    </div>
                  )}

                  {/* Browser drive loop live step indicator */}
                  {isBrowserDriving && (
                    <div className={isLoading ? "border-t border-border/40 pt-2" : ""}>
                      <button
                        type="button"
                        onClick={() => setIsBrowserChipExpanded((prev) => !prev)}
                        className="flex w-full items-center gap-2 text-left text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                          <Globe className="h-3 w-3 text-emerald-500 animate-pulse" />
                        </div>
                        <span className="flex-1 truncate text-xs text-emerald-400 font-semibold">
                          AI is working on the browser
                        </span>
                        {isBrowserChipExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                      {isBrowserChipExpanded && browserDriveStep && (
                        <p className="mt-1.5 pl-7 text-xs leading-5 text-muted-foreground truncate">
                          {browserDriveStep}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Live thought stream (AI native reasoning) */}
                  {(() => {
                    if (!isLoading) return null;
                    const lastMessage = messages[messages.length - 1];
                    if (!lastMessage || lastMessage.role !== "assistant") return null;

                    const nativeReasoning = (lastMessage.parts ?? [])
                      .filter((part: any) => part.type === "reasoning")
                      .map((part: any) => part.text || part.reasoning)
                      .filter(Boolean)
                      .join("\n")
                      .trim();

                    let extractedReasoning: string | null = null;
                    for (const part of lastMessage.parts ?? []) {
                      if (isTextPart(part)) {
                        const { reasoning } = extractReasoningAndContent(part.text);
                        if (reasoning) {
                          extractedReasoning = reasoning;
                          break;
                        }
                      }
                    }

                    const liveText = nativeReasoning || extractedReasoning;
                    if (!liveText) return null;

                    return (
                      <div className="mt-1 border-t border-border/40 pt-2 text-xs leading-5 text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-semibold text-primary/80 mb-1">
                          <Brain className="h-3.5 w-3.5 animate-pulse" />
                          <span>Live Thought Stream</span>
                        </div>
                        <div className="whitespace-pre-wrap break-words">{liveText}</div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border/70 bg-background/85 px-3 pb-5 pt-4 backdrop-blur-xl sm:px-6">
            <TokenUsageMeter
              usage={tokenUsage}
              durationMs={lastTurnDurationMs}
              className="mb-2.5"
            />
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={handleSend}
              isLoading={effectiveIsLoading}
              queuedMessageCount={queuedMessages.length}
              onStop={stop}
              workspaceScope={desktopScope}
              onPickWorkspaceFolder={handlePickWorkspaceFolder}
              permissionMode={permissionMode}
              onPermissionModeChange={handlePermissionModeChange}
              model={selectedModel}
              onModelChange={setSelectedModel}
              effort={reasoningEffort}
              onEffortChange={setReasoningEffort}
              speed={modelSpeed}
              onSpeedChange={setModelSpeed}
            />
          </div>
        </div>

        {isBrowserPaneOpen && activeBrowserSessionId && (

          <BrowserWorkspacePane
            sessionId={activeBrowserSessionId}
            isOpen={isBrowserPaneOpen}
            onClose={() => {
              setIsBrowserPaneOpen(false);
              writeBrowserWorkspacePreference(browserWorkspaceStorageKey, false);
            }}
          />
        )}

        {/* Desktop automation pane */}
        {hasActiveDesktopWorkflow && isDesktopWorkspaceOpen && (
          <DesktopWorkspacePane
            sessionId={"desktop"}
            isOpen={isDesktopWorkspaceOpen}
            onClose={() => setIsDesktopWorkspaceOpen(false)}
          />
        )}
      </div>
    </>
  );
}
