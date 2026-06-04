import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  convertToModelMessages,
} from "ai";
import { createHash } from "crypto";
import { requireAuth } from "@/lib/firebase/middleware";
import admin, { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

import {
  buildSystemPrompt,
  loadSystemPromptContext,
} from "@/lib/ai/system-prompt";
import { buildFreeTierWebResearchContext } from "@/lib/ai/free-tier-web-research";
import {
  buildWindowsMicrophonePermissionWorkflow,
  canUseWindowsMicrophonePermissionWorkflow,
  detectDesktopPermissionIntent,
  normalizeDesktopPlatform,
} from "@/lib/ai/desktop-permission-intent";
import {
  buildClickyDesktopOperatorWorkflow,
  buildDirectDesktopWorkflow,
  buildDesktopLaunchIntentFromTarget,
  buildDesktopLaunchWorkflow,
  detectDesktopLaunchFollowUpIntent,
  detectDesktopLaunchIntent,
  hasClickyDesktopOperatorIntent,
  hasDirectDesktopWorkflowIntent,
  isDesktopLaunchRepeatRequest,
  type DesktopLaunchAction,
  type DesktopLaunchIntent,
  type DesktopLaunchWorkflowInput,
} from "@/lib/ai/desktop-launch-intent";
import {
  buildBrowserTaskInstruction,
  describeQuickOpenTarget,
  inferQuickStartUrl,
  shouldAskForSignupAccountIdentifier,
  shouldAskForSignupTarget,
  shouldForceBrowserTaskFirstStep,
} from "@/lib/ai/browser-navigation";
import { createToolRegistry } from "@/lib/ai/tools";
import { resolveChatAgentForUser } from "@/lib/work/platform";
import { resolveWorkToolAccess } from "@/lib/work/skills";
import {
  resolveChatModelOption,
  resolveChatModelTier,
  resolveChatProviderModel,
} from "@/lib/ai/models";
import {
  buildProviderOptionsForRoute,
  buildNoModelConfiguredMessage,
  inferAIProviderTask,
  isNvidiaNemotronReasoningModel,
  resolveModelForChat,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
// mempalace functions are imported dynamically inside the POST handler to avoid unintentional project-wide NFT tracing
// import { buildMempalaceRecallContext, captureMempalaceConversation } from "@/lib/ai/mempalace";
import {
  buildStoredUserMessageParts,
  buildUserMessageSummary,
  extractIncomingMessageImageSources,
  extractIncomingMessageText,
  messageHasImageParts,
  normalizeIncomingMessagesForModel,
} from "@/lib/ai/message-parts";
import { detectGmailComposeIntent } from "@/lib/ai/gmail-compose-intent";
import type { GmailComposeToolInput } from "@/lib/integrations/gmail/compose-shared";
import {
  buildDesignMediaResultCopy,
  detectMediaGenerationIntent,
} from "@/lib/ai/media-intent";
import { detectTradingPairIntent } from "@/lib/ai/trading-intent";
import type { Timeframe } from "@/types/trading";
import {
  buildSimpleGreetingResponse,
  detectSimpleGreetingIntent,
} from "@/lib/ai/simple-greeting";
import {
  detectNativeTransferIntent,
  isUnsupportedTokenTransferIntent,
} from "@/lib/transactions/intent";
import { DEFAULT_PLAN } from "@/lib/plans";
import { CHAT_CONFIG } from "@/lib/utils/constants";
import { detectAndProcessCommand } from "@/lib/ai/smart-commands";
import { getReadableErrorMessage } from "@/lib/error-message";
import {
  buildProactiveAssistantAlert,
  shouldCreateProactiveAssistantAlert,
} from "@/lib/assistant-alerts";
import { createAssistantAlertRecord } from "@/lib/assistant-alerts-store";
import { isScreenReadIntent } from "@/lib/screen-intent";
import { normalizeChatPermissionMode } from "@/lib/chat/permissions";
import { maybeAutoSaveImportantMemory } from "./_helpers/auto-memory";
import {
  buildTradingOpinionSummary,
  isBlenderIntent,
  isVerifiedTraderSignalRequest,
} from "./_helpers/intents";
import {
  findBrowserConnectionOutputInfoInMessage,
  findLatestBrowserConnectionOutputInfo,
  getBrowserConnectionStatus,
  hasBrowserAutomationAfterPosition,
  hasBrowserTaskForConnection,
  isMissingBrowserContinuationTask,
  resolveBrowserTaskText,
} from "./_helpers/browser-continuation";
import {
  buildCapabilityResponse,
  isCapabilityQuestion,
} from "./_helpers/capabilities";
import {
  mergeReplayMessages,
  normalizeIncomingReplayMessages,
  type StoredReplayMessage,
} from "./_helpers/history-replay";
import { buildMemoryToolTrace } from "./_helpers/memory-trace";
import {
  ensureModelMessageImageTokenAlignment,
  extractAssistantMessageText,
  extractFallbackUserText,
  findLatestUserMessage,
  normalizeStoredParts,
  sanitizeOutboundModelMessages,
} from "./_helpers/message-normalization";
import {
  type AssistantMessageRecord,
  type IncomingMessage,
  type StoredChat,
  type StoredProject,
  type ToolResultPart,
  isRecord,
} from "./_helpers/types";
import { createServerLogger } from "@/lib/server-logger";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const log = createServerLogger("ChatApi");

type DirectToolExecute<Input> = (
  input: Input,
  options: {
    toolCallId: string;
    messages: unknown;
  }
) => Promise<unknown>;

type TradingOpinionToolInput = {
  symbol: string;
  timeframe: Timeframe;
};

function assistantMessagesFromValue(value: unknown): AssistantMessageRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .filter((message) => message.role === "assistant")
    .map((message) => ({
      id: typeof message.id === "string" ? message.id : undefined,
      role: "assistant",
      content: message.content,
    }));
}

function toolInvocationsFromContent(content: unknown) {
  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .filter(isRecord)
    .filter((part) => part.type === "tool-call")
    .map((part) => ({
      toolName: typeof part.toolName === "string" ? part.toolName : "",
      args: "args" in part ? part.args : {},
    }));
}

function toolErrorsFromContent(content: unknown) {
  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .filter(isRecord)
    .filter((part): part is ToolResultPart & Record<string, unknown> => part.type === "tool-result")
    .map((part) => {
      const payload = part.result !== undefined ? part.result : part.output;
      if (!isRecord(payload) || payload.ok !== false) {
        return null;
      }

      return {
        toolName: part.toolName || "unknown",
        errorCode:
          typeof payload.errorCode === "string"
            ? payload.errorCode
            : "TOOL_ERROR",
        message:
          typeof payload.message === "string"
            ? payload.message
            : "Tool returned an error.",
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function fallbackToolPartsFromFinishEvent(event: unknown): Array<Record<string, unknown>> {
  const eventRecord = isRecord(event) ? event : null;
  const parts: Array<Record<string, unknown>> = [];

  if (typeof eventRecord?.text === "string" && eventRecord.text) {
    parts.push({ type: "text", text: eventRecord.text });
  }

  if (Array.isArray(eventRecord?.toolCalls)) {
    for (const toolCall of eventRecord.toolCalls) {
      const call = isRecord(toolCall) ? toolCall : null;
      const fallbackToolCallId =
        typeof call?.toolCallId === "string" && call.toolCallId.trim()
          ? call.toolCallId
          : `fallback-tool-${crypto.randomUUID()}`;

      parts.push({
        type: "tool-call",
        toolCallId: fallbackToolCallId,
        toolName: typeof call?.toolName === "string" ? call.toolName : undefined,
        args: call && "args" in call ? call.args : {},
      });
    }
  }

  return parts;
}

function desktopWorkflowInputToRecord(
  input: DesktopLaunchWorkflowInput
): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description,
    steps: input.steps,
  };
}

const FULL_ACCESS_TOOL_NAMES = [
  "runBrowserTask",
  "controlBrowserSession",
  "stopBrowserSession",
  "runTerminalCommand",
  "listDirectory",
  "readFile",
  "executeWorkflow",
  "planWorkflow",
  "listWorkflowTemplates",
  "getWorkflowStatus",
  "askUser",
  "requestBrowserConnection",
];

const CHAT_HISTORY_REPLAY_LIMIT = 80;

function findPreviousUserText(messages: IncomingMessage[]) {
  let skippedLatestUser = false;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }

    if (!skippedLatestUser) {
      skippedLatestUser = true;
      continue;
    }

    const text = extractIncomingMessageText(message);
    if (text) {
      return text;
    }
  }

  return "";
}

function cloneDesktopLaunchAction(
  action: Record<string, unknown>
): DesktopLaunchAction | null {
  if (action.type === "launchApp") {
    const appPath = typeof action.appPath === "string" ? action.appPath.trim() : "";
    if (!appPath) {
      return null;
    }

    const args = Array.isArray(action.args)
      ? action.args.map(String).filter(Boolean)
      : undefined;

    return {
      type: "launchApp",
      appPath,
      ...(args && args.length > 0 ? { args } : {}),
      wait: action.wait === false ? false : true,
    };
  }

  if (action.type === "openPath") {
    const target = typeof action.target === "string" ? action.target.trim() : "";
    if (!target) {
      return null;
    }

    return {
      type: "openPath",
      target,
      wait: action.wait === false ? false : true,
    };
  }

  return null;
}

function buildDesktopLaunchIntentFromWorkflowInput(
  value: unknown
): DesktopLaunchIntent | null {
  if (!isRecord(value) || !Array.isArray(value.steps)) {
    return null;
  }

  const firstStep = value.steps.find(isRecord);
  if (!firstStep || !isRecord(firstStep.action)) {
    return null;
  }

  const action = cloneDesktopLaunchAction(firstStep.action);
  if (!action) {
    return null;
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const labelFromName = name.replace(/^open\s+/i, "").trim();
  const target =
    action.type === "launchApp" ? action.appPath : action.target;
  const label = labelFromName || target;

  return {
    kind:
      action.type === "openPath" || /^https?:\/\//i.test(target)
        ? "browser"
        : "app",
    label,
    target,
    action,
  };
}

function findLastDesktopLaunchIntent(messages: IncomingMessage[]) {
  for (let index = messages.length - 2; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message)) {
      continue;
    }
    const messageRecord = message as Record<string, unknown>;

    if (message.role === "assistant") {
      const metadata = isRecord(messageRecord.metadata)
        ? messageRecord.metadata
        : null;
      if (
        metadata?.manualDesktopLaunchWorkflow === true &&
        typeof metadata.desktopLaunchTarget === "string"
      ) {
        const intent = buildDesktopLaunchIntentFromTarget(
          metadata.desktopLaunchTarget
        );
        if (intent) {
          return intent;
        }
      }

      const parts = Array.isArray(message.parts) ? message.parts : [];
      for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
        const part = parts[partIndex];
        if (!isRecord(part) || part.toolName !== "planWorkflow") {
          continue;
        }

        const workflowInput = part.input ?? part.args;
        const intent = buildDesktopLaunchIntentFromWorkflowInput(workflowInput);
        if (intent && /^open\s+/i.test(String(isRecord(workflowInput) ? workflowInput.name ?? "" : ""))) {
          return intent;
        }
      }
      continue;
    }

    if (message.role === "user") {
      const intent = detectDesktopLaunchIntent(extractIncomingMessageText(message));
      if (intent) {
        return intent;
      }
    }
  }

  return null;
}

async function claimBrowserTaskForConnection(
  chatId: string,
  connectionToolCallId: string
) {
  const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
  let claimed = false;

  await adminDb.runTransaction(async (transaction) => {
    const chatSnap = await transaction.get(chatRef);
    const chatData = chatSnap.data() as
      | { browser_task_connection_ids?: unknown }
      | undefined;
    const existingIds = Array.isArray(chatData?.browser_task_connection_ids)
      ? chatData.browser_task_connection_ids
      : [];

    if (existingIds.includes(connectionToolCallId)) {
      return;
    }

    claimed = true;
    transaction.update(chatRef, {
      browser_task_connection_ids:
        admin.firestore.FieldValue.arrayUnion(connectionToolCallId),
      updated_at: new Date().toISOString(),
    });
  });

  return claimed;
}

async function releaseBrowserTaskForConnection(
  chatId: string,
  connectionToolCallId: string
) {
  await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).update({
    browser_task_connection_ids:
      admin.firestore.FieldValue.arrayRemove(connectionToolCallId),
  });
}

function createSilentChatResponse(chatId: string | null) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({
        type: "start",
        messageId: crypto.randomUUID(),
        messageMetadata: chatId ? { chatId } : undefined,
      });
      writer.write({ type: "start-step" });
      writer.write({ type: "finish-step" });
      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: chatId ? { chatId } : undefined,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function createTextChatStreamResponse(params: {
  chatId: string | null;
  messageId: string;
  text: string;
}) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const messageMetadata = { chatId: params.chatId };
      const textId = `text-${params.messageId}`;

      writer.write({
        type: "start",
        messageId: params.messageId,
        messageMetadata,
      });
      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: params.text });
      writer.write({ type: "text-end", id: textId });
      writer.write({ type: "finish-step" });
      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function createToolChatStreamResponse(params: {
  chatId: string | null;
  messageId: string;
  toolCallId?: string | null;
  toolName?: string | null;
  input?: unknown;
  output?: unknown;
  text?: string | null;
  providerExecuted?: boolean;
}) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const messageMetadata = { chatId: params.chatId };
      const hasTool =
        Boolean(params.toolCallId) && Boolean(params.toolName);

      writer.write({
        type: "start",
        messageId: params.messageId,
        messageMetadata,
      });
      writer.write({ type: "start-step" });

      if (hasTool && params.input !== undefined) {
        writer.write({
          type: "tool-input-available",
          toolCallId: params.toolCallId as string,
          toolName: params.toolName as string,
          input: params.input,
          dynamic: true,
          ...(params.providerExecuted ? { providerExecuted: true } : {}),
        });
      }

      if (hasTool && params.output !== undefined) {
        writer.write({
          type: "tool-output-available",
          toolCallId: params.toolCallId as string,
          output: params.output,
          dynamic: true,
          ...(params.providerExecuted ? { providerExecuted: true } : {}),
        });
      }

      if (params.text) {
        const textId = `text-${params.messageId}`;
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: params.text });
        writer.write({ type: "text-end", id: textId });
      }

      writer.write({ type: "finish-step" });
      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function updateChatAfterAssistantMessage(params: {
  chatId: string;
  nowIso: string;
  titleSource?: string | null;
}) {
  const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(params.chatId);
  const chatSnap = await chatRef.get();
  const existingChat = chatSnap.data() as StoredChat | undefined;
  const chatUpdates: Record<string, unknown> = { updated_at: params.nowIso };
  const titleSource = params.titleSource?.trim();

  if (!existingChat?.title && titleSource) {
    chatUpdates.title =
      titleSource.slice(0, 60) + (titleSource.length > 60 ? "..." : "");
  }

  await chatRef.update(chatUpdates);
}

async function createDeterministicTextChatResponse(params: {
  chatId: string;
  assistantText: string;
  metadata: Record<string, unknown>;
  titleSource?: string | null;
}) {
  const assistantMessageId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  try {
    await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
      chat_id: params.chatId,
      role: "assistant",
      content: params.assistantText,
      parts: normalizeStoredParts([{ type: "text", text: params.assistantText }]),
      tool_invocations: null,
      metadata: params.metadata,
      created_at: nowIso,
    });

    await updateChatAfterAssistantMessage({
      chatId: params.chatId,
      nowIso,
      titleSource: params.titleSource,
    });
  } catch (error) {
    log.error("Failed to save deterministic assistant message:", error);
  }

  return createTextChatStreamResponse({
    chatId: params.chatId,
    messageId: assistantMessageId,
    text: params.assistantText,
  });
}

function normalizeBrowserDedupeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildBrowserTaskDedupeKey(params: {
  chatId: string;
  userMessageId?: string | null;
  connectionToolCallId?: string | null;
  task: string;
}) {
  const stableInput = JSON.stringify({
    chatId: params.chatId,
    turn: params.connectionToolCallId || params.userMessageId || "latest",
    task: normalizeBrowserDedupeText(params.task),
  });

  return `browser:${createHash("sha256").update(stableInput).digest("hex").slice(0, 32)}`;
}

type SignupAccountIdentifierState = {
  status: "pending" | "answered" | "skipped" | "rejected";
  answer: string | null;
};

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getToolNameFromPart(part: Record<string, unknown>) {
  if (typeof part.toolName === "string" && part.toolName.trim()) {
    return part.toolName.trim();
  }

  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.replace(/^tool-/, "");
  }

  return "";
}

function findLatestSignupAccountIdentifierState(
  messages: IncomingMessage[],
  requestedAction: string
): SignupAccountIdentifierState | null {
  const requestedActionKey = normalizeBrowserDedupeText(requestedAction);

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (!message || message.role !== "assistant" || !Array.isArray(message.parts)) {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts[partIndex];
      if (!isRecord(part) || getToolNameFromPart(part) !== "askUser") {
        continue;
      }

      const input = isRecord(part.input)
        ? part.input
        : isRecord(part.args)
          ? part.args
          : null;

      if (input?.purpose !== "signup_account_identifier") {
        continue;
      }

      const inputRequestedAction = firstNonEmptyString(input.requestedAction);
      if (
        requestedActionKey &&
        inputRequestedAction &&
        normalizeBrowserDedupeText(inputRequestedAction) !== requestedActionKey
      ) {
        continue;
      }

      const output = isRecord(part.output)
        ? part.output
        : isRecord(part.result)
          ? part.result
          : null;
      const status = firstNonEmptyString(output?.status);

      if (
        status === "answered" ||
        status === "skipped" ||
        status === "rejected"
      ) {
        return {
          status,
          answer: firstNonEmptyString(output?.answer, output?.choice),
        };
      }

      return { status: "pending", answer: null };
    }
  }

  return null;
}

function enrichSignupBrowserTaskText(
  taskText: string,
  state: SignupAccountIdentifierState | null
) {
  if (state?.status !== "answered" || !state.answer) {
    return taskText;
  }

  if (taskText.toLowerCase().includes(state.answer.toLowerCase())) {
    return taskText;
  }

  return [
    taskText.trim(),
    `Use this email for non-sensitive account identifier fields: ${state.answer}.`,
    "Do not create or enter passwords, one-time codes, recovery codes, payment details, or CAPTCHA responses. Pause and keep the browser open when those steps appear.",
  ].join(" ");
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*_{}[\]()#+.!|-])/g, "\\$1");
}

function safeMarkdownLink(label: string, url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return `[${label.replace(/]/g, "\\]")}](${parsed.toString()})`;
  } catch {
    return null;
  }
}

function getBrowserAuthStepLabel(currentUrl: string | null, title: string | null) {
  const haystack = `${currentUrl || ""} ${title || ""}`.toLowerCase();
  if (haystack.includes("accounts.google.com") || haystack.includes("google sign")) {
    return "Google sign-in";
  }

  if (haystack.includes("login") || haystack.includes("sign in") || haystack.includes("signin")) {
    return "sign-in";
  }

  if (haystack.includes("captcha")) {
    return "CAPTCHA";
  }

  if (haystack.includes("checkout") || haystack.includes("payment")) {
    return "payment";
  }

  return "";
}

function getBrowserExecutionProgress(status: string | null, summary: string | null) {
  if (summary) {
    return summary;
  }

  if (status === "completed") {
    return "Rearvy completed the browser step it could safely automate.";
  }

  if (status === "awaiting_approval") {
    return "Rearvy paused before an action that needs your approval.";
  }

  if (status === "running" || status === "initializing" || status === "processing_command") {
    return "Rearvy started the browser session and is working through the requested flow.";
  }

  return "Rearvy opened a browser session for the requested flow.";
}

function buildBrowserExecutionSummary(params: {
  targetLabel: string;
  browserTaskInstruction: string;
  toolOutput: Record<string, unknown> | null;
  signupAccountIdentifierState: SignupAccountIdentifierState | null;
}) {
  const { targetLabel, browserTaskInstruction, toolOutput, signupAccountIdentifierState } = params;
  const status = firstNonEmptyString(toolOutput?.status);
  const summary = firstNonEmptyString(toolOutput?.summary, toolOutput?.message);
  const currentUrl = firstNonEmptyString(toolOutput?.currentUrl);
  const title = firstNonEmptyString(toolOutput?.title);
  const browserSessionId = firstNonEmptyString(toolOutput?.browserSessionId);
  const signupEmail =
    signupAccountIdentifierState?.status === "answered"
      ? signupAccountIdentifierState.answer
      : null;
  const isSignupFlow =
    Boolean(signupEmail) ||
    /\b(sign\s*up|signup|register|account creation|create an? account)\b/i.test(
      browserTaskInstruction
    );
  const actionStep = getBrowserAuthStepLabel(currentUrl, title);
  const link = safeMarkdownLink(
    `${targetLabel}${isSignupFlow ? " signup" : ""} current step`,
    currentUrl
  );
  const intro = isSignupFlow
    ? signupEmail
      ? `I have initiated the ${targetLabel} signup process using the email address **${escapeMarkdownText(signupEmail)}**.`
      : `I have initiated the ${targetLabel} signup process.`
    : `I have opened ${targetLabel} and started the requested browser workflow.`;
  const progress = getBrowserExecutionProgress(status, summary);
  const actionNeeded = actionStep
    ? `I am at the ${actionStep} step. For security reasons, you need to complete passwords, 2FA, CAPTCHA, payment, or recovery-code steps directly in the browser.`
    : "If the browser asks for a password, 2FA, CAPTCHA, payment, recovery code, or other sensitive detail, complete that step directly in the browser.";
  const currentStep = title || currentUrl;

  return [
    intro,
    "",
    "**Current Status:**",
    `- **Progress:** ${progress}`,
    currentStep ? `- **Current Step:** ${currentStep}` : null,
    `- **Action Needed:** ${actionNeeded}`,
    "",
    "**How to Finish:**",
    "1. Switch to the browser tab I opened.",
    isSignupFlow
      ? "2. Complete the secure sign-in or account verification step directly in the browser."
      : "2. Complete any secure or manual step directly in the browser.",
    isSignupFlow
      ? `3. Continue the ${targetLabel} signup details after authentication.`
      : "3. Return here when you want Rearvy to continue or verify the result.",
    link ? `${isSignupFlow ? "Sign up" : "Open"} here: ${link}.` : null,
    browserSessionId && !link ? `Browser session: \`${browserSessionId}\`.` : null,
    "",
    isSignupFlow
      ? "Would you like me to wait while you finish and then help set up the next step?"
      : "Would you like me to keep going from this browser state?",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function POST(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";
  const desktopHeader = req.headers.get("x-rearvy-desktop") || "";
  const isDesktopApp =
    desktopHeader === "1" ||
    desktopHeader.toLowerCase() === "true" ||
    userAgent.toLowerCase().includes("electron");

  try {

  const [payload, auth] = await Promise.all([req.json(), requireAuth(req)]);
  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  let messages = normalizeIncomingReplayMessages(rawMessages);
  const chatId = typeof payload?.chatId === "string" ? payload.chatId : null;
  const projectId =
    typeof payload?.projectId === "string" ? payload.projectId : null;
  const hasExplicitAgentSelection =
    payload &&
    typeof payload === "object" &&
    Object.prototype.hasOwnProperty.call(payload, "agentId");
  const rawAgentId =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).agentId
      : undefined;

  const requestedAgentId =
    typeof rawAgentId === "string" && rawAgentId.trim()
      ? rawAgentId.trim()
      : null;

  if (auth.error) {
    return auth.error;
  }
  const user = auth.user!;
  const userPlan = DEFAULT_PLAN;
  const aiModel = resolveChatModelTier(
    payload?.aiModel ?? "deepseek-v4-pro",
    userPlan
  );
  const chatPermissionMode = normalizeChatPermissionMode(
    payload?.chatPermissionMode
  );
  const thinkingMode =
    payload?.thinkingMode === true || payload?.thinkingMode === "true";
  const desktopPlatform = normalizeDesktopPlatform(payload?.desktopPlatform);
  const isFullAccessMode =
    isDesktopApp && (chatPermissionMode === "full-access" || chatPermissionMode === "bypass");
  if (!aiModel) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid aiModel. Please retry with a supported model without auto-switching.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  let lastMessage =
    messages.length > 0
      ? (messages[messages.length - 1] as IncomingMessage)
      : null;
  const incomingLastMessage = lastMessage;
  const isIncomingLastMessageUser = incomingLastMessage?.role === "user";
  let isLastMessageUser = lastMessage?.role === "user";
  let userMessageSummary = lastMessage
    ? buildUserMessageSummary(lastMessage)
    : "";
  let latestUserMessage = findLatestUserMessage(messages);
  let effectiveUserMessage: IncomingMessage | null =
    isLastMessageUser && userMessageSummary ? lastMessage : latestUserMessage;
  if (!effectiveUserMessage) {
    const fallbackUserText = extractFallbackUserText(payload, messages);
    if (fallbackUserText) {
      effectiveUserMessage = {
        role: "user",
        content: fallbackUserText,
        parts: [{ type: "text", text: fallbackUserText }],
      };
    }
  }

  let effectiveUserText =
    effectiveUserMessage ? extractIncomingMessageText(effectiveUserMessage) : "";
  let effectiveUserMessageSummary = effectiveUserMessage
    ? buildUserMessageSummary(effectiveUserMessage)
    : "";
  let resolvedChatId = chatId;
  let resolvedProjectId = projectId;
  let resolvedProject: StoredProject | null = null;
  let resolvedAgentId: string | null = requestedAgentId;

  if (resolvedChatId) {
    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
    const chatSnap = await chatRef.get();
    const chat = chatSnap.data() as StoredChat | undefined;

    const isOwner = chat?.user_id === user.uid;
    const isParticipant =
      Array.isArray(chat?.participant_ids) &&
      chat.participant_ids.includes(user.uid);

    if (!chat || (!isOwner && !isParticipant)) {
      return new Response("Chat not found", { status: 404 });
    }

    if (resolvedProjectId && chat.project_id !== resolvedProjectId) {
      return new Response("Chat/project mismatch", { status: 400 });
    }

    if (!resolvedProjectId && typeof chat.project_id === "string") {
      resolvedProjectId = chat.project_id;
    }

    if (!hasExplicitAgentSelection) {
      resolvedAgentId =
        typeof chat.agent_id === "string" && chat.agent_id.trim()
          ? chat.agent_id
          : null;
    } else if ((chat.agent_id ?? null) !== resolvedAgentId) {
      void chatRef.update({
        agent_id: resolvedAgentId,
        updated_at: new Date().toISOString(),
      }).catch((error) => {
        log.error("Failed to update chat agent:", error);
      });
    }
  } else {
    if (!effectiveUserMessage || !effectiveUserMessageSummary) {
      return new Response("Missing user message", { status: 400 });
    }

    if (resolvedProjectId) {
      const projectRef = adminDb
        .collection(COLLECTIONS.PROJECTS)
        .doc(resolvedProjectId);
      const projectSnap = await projectRef.get();
      const project = projectSnap.data() as StoredProject | undefined;

      if (!project || project.user_id !== user.uid) {
        return new Response("Project not found", { status: 404 });
      }

      resolvedProject = project;
    }

    try {
      const createdChatRef = await adminDb
        .collection(COLLECTIONS.CHATS)
        .add({
          user_id: user.uid,
          participant_ids: [user.uid],
          project_id: resolvedProjectId,
          agent_id: resolvedAgentId,
          title: null,
          is_archived: false,
          is_pinned: false,
          is_group: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      resolvedChatId = createdChatRef.id;
    } catch (error) {
      log.error("Failed to create chat:", error);
      return new Response("Failed to create chat", { status: 500 });
    }
  }

  if (!resolvedProject && resolvedProjectId) {
    const projectRef = adminDb
      .collection(COLLECTIONS.PROJECTS)
      .doc(resolvedProjectId);
    const projectSnap = await projectRef.get();
    const project = projectSnap.data() as StoredProject | undefined;

    if (!project || project.user_id !== user.uid) {
      return new Response("Project not found", { status: 404 });
    }

    resolvedProject = project;
  }

  const shouldPersistIncomingUserMessage = Boolean(
    (isLastMessageUser && userMessageSummary) ||
      (!chatId && effectiveUserMessage && effectiveUserMessageSummary)
  );

  if (shouldPersistIncomingUserMessage && effectiveUserMessage && effectiveUserMessageSummary) {
    if (!resolvedChatId) {
      return new Response("Chat not ready", { status: 500 });
    }

    try {
      const messageId = effectiveUserMessage.id;
      const nowIso = new Date().toISOString();
      const storedParts =
        buildStoredUserMessageParts(effectiveUserMessage);
      const messagePayload = {
        chat_id: resolvedChatId,
        role: "user",
        content: effectiveUserMessageSummary || null,
        parts:
          storedParts ??
          (effectiveUserText
            ? [{ type: "text", text: effectiveUserText }]
            : null),
        tool_invocations: null,
        metadata: { source: "chat_request" },
        created_at: nowIso,
      };
      const batch = adminDb.batch();
      const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
      const messageRef = messageId
        ? adminDb.collection(COLLECTIONS.MESSAGES).doc(messageId)
        : adminDb.collection(COLLECTIONS.MESSAGES).doc();

      batch.set(messageRef, messagePayload);
      batch.update(chatRef, { updated_at: nowIso });
      await batch.commit();
    } catch (error) {
      log.error("Failed to persist user message:", error);
      return new Response("Failed to save message", { status: 500 });
    }
  }

  if (resolvedChatId) {
    try {
      const persistedMessagesSnapshot = await adminDb
        .collection(COLLECTIONS.MESSAGES)
        .where("chat_id", "==", resolvedChatId)
        .orderBy("created_at", "asc")
        .get();
      const persistedMessages = persistedMessagesSnapshot.docs
        .slice(-CHAT_HISTORY_REPLAY_LIMIT)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as StoredReplayMessage[];

      messages = mergeReplayMessages({
        persistedMessages,
        incomingMessages: messages,
      });
      lastMessage =
        messages.length > 0
          ? (messages[messages.length - 1] as IncomingMessage)
          : null;
      isLastMessageUser = lastMessage?.role === "user";
      userMessageSummary = lastMessage
        ? buildUserMessageSummary(lastMessage)
        : "";
      latestUserMessage = findLatestUserMessage(messages);
      effectiveUserMessage =
        isLastMessageUser && userMessageSummary ? lastMessage : latestUserMessage;
      effectiveUserText = effectiveUserMessage
        ? extractIncomingMessageText(effectiveUserMessage)
        : "";
      effectiveUserMessageSummary = effectiveUserMessage
        ? buildUserMessageSummary(effectiveUserMessage)
        : "";
    } catch (error) {
      log.error("Failed to load chat history for model replay:", error);
    }
  }

  const simpleGreetingIntent = detectSimpleGreetingIntent(effectiveUserText);

  if (effectiveUserText && !simpleGreetingIntent) {
    void maybeAutoSaveImportantMemory({
      adminDb,
      userId: user.uid,
      userText: effectiveUserText,
      projectId: resolvedProjectId,
    });
  }

  let resolvedAgent: Awaited<ReturnType<typeof resolveChatAgentForUser>> = null;
  if (resolvedAgentId) {
    resolvedAgent = await resolveChatAgentForUser(
      adminDb,
      user.uid,
      resolvedAgentId
    );

    if (!resolvedAgent) {
      if (hasExplicitAgentSelection) {
        return new Response(
          JSON.stringify({ error: "Invalid agentId." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      resolvedAgentId = null;
    }
  }

  if (
    isLastMessageUser &&
    effectiveUserText &&
    resolvedChatId &&
    simpleGreetingIntent
  ) {
    const modelOption = resolveChatModelOption(aiModel);
    const selectedProviderModel = resolveChatProviderModel(aiModel, {
      hasImageInput: messages.some((message) => messageHasImageParts(message)),
    });

    return createDeterministicTextChatResponse({
      chatId: resolvedChatId,
      assistantText: buildSimpleGreetingResponse(simpleGreetingIntent),
      titleSource: effectiveUserText || userMessageSummary,
      metadata: {
        model: selectedProviderModel,
        defaultModel: modelOption.providerModel,
        modelTier: aiModel,
        plan: userPlan,
        deterministicIntent: "simple_greeting",
        agentName: resolvedAgent?.name ?? "Rearvy",
        ...(resolvedAgent
          ? {
              agentId: resolvedAgent.id,
              agentName: resolvedAgent.name,
            }
          : {}),
      },
    });
  }

  const signupAccountIdentifierState =
    effectiveUserText && resolvedChatId
      ? findLatestSignupAccountIdentifierState(
          messages as IncomingMessage[],
          effectiveUserText
        )
      : null;

  if (
    isLastMessageUser &&
    effectiveUserText &&
    resolvedChatId &&
    shouldAskForSignupTarget(effectiveUserText)
  ) {
    const assistantMessageId = crypto.randomUUID();
    const toolCallId = `askUser-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const modelOption = resolveChatModelOption(aiModel);
    const selectedProviderModel = resolveChatProviderModel(aiModel, {
      hasImageInput: messages.some((message) => messageHasImageParts(message)),
    });
    const askUserInput = {
      kind: "clarification",
      title: "Please reply to continue",
      prompt:
        "I can help with that browser sign-in or signup flow, but I need the service or website first. Which site or app should I use?",
      context:
        "I can open the browser and guide the flow. If a password, CAPTCHA, verification email, SMS code, or payment step appears, I will pause so you can complete it.",
      allowSkip: true,
      sensitive: false,
      requestedAction: effectiveUserText,
    };
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName: "askUser",
        args: askUserInput,
      },
    ];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: null,
        parts: normalizeStoredParts(assistantContent),
        tool_invocations: [
          {
            toolName: "askUser",
            args: askUserInput,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          manualAskUser: true,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save ask-user assistant message:", error);
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: "start",
          messageId: assistantMessageId,
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
        writer.write({ type: "start-step" });
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: "askUser",
          input: askUserInput,
          dynamic: true,
        });
        writer.write({ type: "finish-step" });
        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  if (
    isLastMessageUser &&
    effectiveUserText &&
    resolvedChatId &&
    shouldAskForSignupAccountIdentifier(effectiveUserText) &&
    !signupAccountIdentifierState
  ) {
    const assistantMessageId = crypto.randomUUID();
    const toolCallId = `askUser-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const modelOption = resolveChatModelOption(aiModel);
    const selectedProviderModel = resolveChatProviderModel(aiModel, {
      hasImageInput: messages.some((message) => messageHasImageParts(message)),
    });
    const startUrl = inferQuickStartUrl(effectiveUserText);
    const targetLabel = startUrl
      ? describeQuickOpenTarget(null, startUrl)
      : "the requested site";
    const askUserInput = {
      kind: "clarification",
      purpose: "signup_account_identifier",
      title: "Please reply to continue",
      prompt: `I've initiated the ${targetLabel} signup process. To proceed, what email address should I use for the new account?`,
      placeholder: "e.g., hello@rearvy.com",
      context:
        "I will not ask you to share passwords, verification codes, payment details, recovery codes, or CAPTCHA answers in chat.",
      allowSkip: false,
      sensitive: false,
      requestedAction: effectiveUserText,
    };
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName: "askUser",
        args: askUserInput,
      },
    ];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: null,
        parts: normalizeStoredParts(assistantContent),
        tool_invocations: [
          {
            toolName: "askUser",
            args: askUserInput,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          manualAskUser: true,
          signupAccountIdentifierRequest: true,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save signup email ask-user message:", error);
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: "start",
          messageId: assistantMessageId,
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
        writer.write({ type: "start-step" });
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: "askUser",
          input: askUserInput,
          dynamic: true,
        });
        writer.write({ type: "finish-step" });
        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  if (effectiveUserText && resolvedChatId) {
    const unsupportedTokenTransferIntent =
      isUnsupportedTokenTransferIntent(effectiveUserText);
    const nativeTransferIntent = unsupportedTokenTransferIntent
      ? null
      : detectNativeTransferIntent(effectiveUserText);

    if (unsupportedTokenTransferIntent || nativeTransferIntent) {
      const assistantMessageId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const transactionModelOption = resolveChatModelOption(aiModel);
      const transactionProviderModel = resolveChatProviderModel(aiModel, {
        hasImageInput: messages.some((message) => messageHasImageParts(message)),
      });
      const transactionAgent = resolvedAgent;
      let assistantText =
        "Rearvy can only draft native EVM transfers in v1. Token transfers, ERC-20 transfers, contract calls, and calldata are blocked.";
      const metadata: Record<string, unknown> = {
        model: transactionProviderModel,
        defaultModel: transactionModelOption.providerModel,
        modelTier: aiModel,
        plan: userPlan,
        transactionIntent: true,
        transactionDraft: false,
        approvalRequired: true,
        serverExecution: false,
        ...(transactionAgent
          ? {
              agentId: transactionAgent.id,
              agentName: transactionAgent.name,
            }
          : {}),
      };

      if (nativeTransferIntent) {
        assistantText = [
          "MetaMask transaction drafts are unavailable because the Operations Console approval flow has been removed.",
          "I did not create, approve, submit, or access your wallet for this request.",
        ].join("\n");

        metadata.transactionDraft = false;
        metadata.transactionStatus = "unavailable";
      }

      try {
        await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
          chat_id: resolvedChatId,
          role: "assistant",
          content: assistantText,
          parts: [{ type: "text", text: assistantText }],
          tool_invocations: null,
          metadata,
          created_at: nowIso,
        });

        const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
        const chatSnap = await chatRef.get();
        const existingChat = chatSnap.data() as StoredChat | undefined;
        const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

        if (!existingChat?.title) {
          const trimmed = (effectiveUserText || userMessageSummary).trim();
          if (trimmed) {
            chatUpdates.title =
              trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
          }
        }

        await chatRef.update(chatUpdates);
      } catch (error) {
        log.error("Failed to save transaction draft assistant message:", error);
      }

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          const textId = `text-${assistantMessageId}`;
          writer.write({
            type: "start",
            messageId: assistantMessageId,
            messageMetadata: {
              chatId: resolvedChatId,
            },
          });
          writer.write({ type: "start-step" });
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: assistantText });
          writer.write({ type: "text-end", id: textId });
          writer.write({ type: "finish-step" });
          writer.write({
            type: "finish",
            finishReason: "stop",
            messageMetadata: {
              chatId: resolvedChatId,
            },
          });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }
  }

  const messagesForModel = normalizeIncomingMessagesForModel(messages);
  const commandResult = detectAndProcessCommand(effectiveUserText);
  let finalMessagesForModel = [...messagesForModel];

  const hasUserMessageInModelInput = finalMessagesForModel.some((message) => {
    if (!isRecord(message)) {
      return false;
    }

    return message.role === "user" && extractIncomingMessageText(message).length > 0;
  });

  // Some first-turn requests can arrive with fallback `text` in payload while
  // `messages` is empty. Ensure the model always receives the effective user turn.
  if (!hasUserMessageInModelInput && effectiveUserMessage) {
    finalMessagesForModel.push(effectiveUserMessage);
  }
  
  if (commandResult.hasCommand && effectiveUserText && finalMessagesForModel.length > 0) {
    const latestUserIndex = [...finalMessagesForModel]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => {
        return (
          typeof message === "object" &&
          message !== null &&
          "role" in message &&
          (message as Record<string, unknown>).role === "user"
        );
      })?.index;

    if (typeof latestUserIndex === "number") {
      const latestUserMessageForModel = finalMessagesForModel[latestUserIndex];
      if (
        typeof latestUserMessageForModel === "object" &&
        latestUserMessageForModel !== null
      ) {
        const updatedUserMsg = {
          ...latestUserMessageForModel,
          content: `[INSTRUCTION: ${commandResult.instruction}]\n\nUser request: ${effectiveUserText}`,
        };

        finalMessagesForModel = finalMessagesForModel.map((message, index) =>
          index === latestUserIndex ? updatedUserMsg : message
        );
      }
    }
  }

  const promptContextPromise = loadSystemPromptContext({
    userId: user.uid,
    projectId: resolvedProjectId,
    adminDb,
    project: resolvedProject,
    responseMode: "deep",
  });

  const modelMessagesPromise = convertToModelMessages(
    finalMessagesForModel as Parameters<typeof convertToModelMessages>[0]
  );
  const mempalaceRecallPromise =
    resolvedChatId && effectiveUserText
      ? import("@/lib/ai/mempalace").then(({ buildMempalaceRecallContext }) =>
          buildMempalaceRecallContext({
            userId: user.uid,
            chatId: resolvedChatId,
            projectId: resolvedProjectId,
            agentId: resolvedAgentId,
            userText: effectiveUserText,
          })
        )
      : Promise.resolve(null);
  const [modelMessages, promptContext, mempalaceRecallContext] = await Promise.all([
    modelMessagesPromise,
    promptContextPromise,
    mempalaceRecallPromise,
  ]);
  const outboundModelMessages = sanitizeOutboundModelMessages(modelMessages).map(
    (message) => ensureModelMessageImageTokenAlignment(message)
  );
  const toolAccess = await resolveWorkToolAccess(adminDb, {
    userId: user.uid,
    agentId: resolvedAgentId,
    isDesktopApp,
  });
  const hasImageInput = messages.some((message) => messageHasImageParts(message));
  const incomingLastMessageImages =
    extractIncomingMessageImageSources(incomingLastMessage);
  const latestUserImageSources =
    incomingLastMessageImages.length > 0
      ? incomingLastMessageImages
      : extractIncomingMessageImageSources(lastMessage);
  const hasScreenReadIntent = effectiveUserText
    ? isScreenReadIntent(effectiveUserText)
    : false;
  const latestBrowserConnectionInfo = findLatestBrowserConnectionOutputInfo(
    messages as IncomingMessage[]
  );
  const latestBrowserConnectionOutput = latestBrowserConnectionInfo?.output ?? null;
  const latestMessageBrowserConnectionInfo =
    findBrowserConnectionOutputInfoInMessage(lastMessage) ??
    findBrowserConnectionOutputInfoInMessage(incomingLastMessage);
  const isBrowserConnectionContinuation = Boolean(
    latestMessageBrowserConnectionInfo &&
      (!isLastMessageUser || !isIncomingLastMessageUser)
  );
  const rawBrowserTaskText = resolveBrowserTaskText({
    effectiveUserText,
    isBrowserConnectionContinuation,
    browserConnectionInput: latestMessageBrowserConnectionInfo?.input ?? null,
  });
  const browserTaskText = rawBrowserTaskText
    ? enrichSignupBrowserTaskText(rawBrowserTaskText, signupAccountIdentifierState)
    : "";
  const isSignupAccountIdentifierContinuation =
    !isLastMessageUser &&
    (signupAccountIdentifierState?.status === "answered" ||
      signupAccountIdentifierState?.status === "skipped");
  const turnIntentText = browserTaskText || effectiveUserText;
  const canHandleForcedBrowserTask =
    isLastMessageUser ||
    isBrowserConnectionContinuation ||
    isSignupAccountIdentifierContinuation;
  const canStartDeterministicDesktopAction =
    isLastMessageUser && isIncomingLastMessageUser;
  const mediaGenerationIntent = detectMediaGenerationIntent(effectiveUserText, {
    hasImageInput: latestUserImageSources.length > 0,
  });
  const shouldForceMediaGeneration =
    canStartDeterministicDesktopAction && Boolean(mediaGenerationIntent);
  const tradingPairIntent = detectTradingPairIntent(effectiveUserText);
  const shouldForceTradingTool =
    Boolean(tradingPairIntent) &&
    !isVerifiedTraderSignalRequest(effectiveUserText);
  const blenderIntent = isDesktopApp && isBlenderIntent(effectiveUserText);
  const desktopPermissionIntent =
    detectDesktopPermissionIntent(effectiveUserText);
  const shouldForceDesktopPermissionWorkflow =
    canStartDeterministicDesktopAction && Boolean(desktopPermissionIntent);
  const previousUserText = canStartDeterministicDesktopAction
    ? findPreviousUserText(messages as IncomingMessage[])
    : "";
  const repeatedDesktopLaunchIntent =
    canStartDeterministicDesktopAction &&
    isDesktopLaunchRepeatRequest(effectiveUserText)
      ? findLastDesktopLaunchIntent(messages as IncomingMessage[])
      : null;
  const desktopLaunchIntent =
    detectDesktopLaunchIntent(effectiveUserText) ??
    detectDesktopLaunchFollowUpIntent(previousUserText, effectiveUserText) ??
    repeatedDesktopLaunchIntent;
  const shouldForceClickyDesktopOperatorWorkflow =
    canStartDeterministicDesktopAction &&
    hasClickyDesktopOperatorIntent(effectiveUserText);
  const shouldForceDirectDesktopWorkflow =
    canStartDeterministicDesktopAction &&
    !shouldForceClickyDesktopOperatorWorkflow &&
    hasDirectDesktopWorkflowIntent(effectiveUserText);
  const shouldForceDesktopLaunchWorkflow =
    canStartDeterministicDesktopAction && Boolean(desktopLaunchIntent);
  const shouldForceBrowserTask =
    browserTaskText && !hasScreenReadIntent && canHandleForcedBrowserTask
      ? shouldForceBrowserTaskFirstStep(browserTaskText)
      : false;
  const shouldForceDesktopScreenshot =
    isDesktopApp &&
    canStartDeterministicDesktopAction &&
    hasScreenReadIntent &&
    !hasImageInput;
  const canUseLocalBrowserTools =
    !process.env.VERCEL && (isDesktopApp || process.env.NODE_ENV === "development");
  const includeWebTools = toolAccess.includeWebTools && !hasScreenReadIntent;
  const freeTierWebResearch = hasScreenReadIntent
    ? null
    : await buildFreeTierWebResearchContext({
        userText: effectiveUserText,
        profile: promptContext.profile
          ? {
              businessName: promptContext.profile.business_name ?? null,
              businessType: promptContext.profile.business_type ?? null,
            }
          : undefined,
        project: promptContext.project
          ? {
              name: promptContext.project.name ?? null,
              description: promptContext.project.description ?? null,
            }
          : null,
        memories: promptContext.memories.map((memory) => ({
          content: memory.content ?? null,
          importance: memory.importance ?? null,
          memoryType: memory.memory_type ?? null,
        })),
      });
  const aiProviderTask = inferAIProviderTask({
    text: turnIntentText,
    hasImageInput,
  });
  const modelOption = resolveChatModelOption(aiModel);
  const selectedProviderModel = resolveChatProviderModel(aiModel, {
    hasImageInput,
  });
  if (
    resolvedChatId &&
    isMissingBrowserContinuationTask({
      isBrowserConnectionContinuation,
      browserConnectionOutput: latestBrowserConnectionOutput,
      browserTaskText,
    })
  ) {
    const assistantMessageId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const assistantText =
      "I can't continue the browser task because the original browser task is missing from this connection step. Please send the website or action again, and I will start from there.";

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText,
        parts: normalizeStoredParts([{ type: "text", text: assistantText }]),
        tool_invocations: null,
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          manualBrowserConnection: true,
          missingBrowserContinuationTask: true,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
        },
        created_at: nowIso,
      });
      await adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId).update({
        updated_at: nowIso,
      });
    } catch (error) {
      log.error("Failed to save missing browser task response:", error);
    }

    return createTextChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      text: assistantText,
    });
  }
  const permissionToolNames =
    isFullAccessMode && toolAccess.allowedToolNames
      ? Array.from(
          new Set([...toolAccess.allowedToolNames, ...FULL_ACCESS_TOOL_NAMES])
        )
      : toolAccess.allowedToolNames;
  const allowedToolNamesForRequest =
    (shouldForceBrowserTask ||
      shouldForceMediaGeneration ||
      shouldForceDesktopScreenshot ||
      shouldForceDesktopPermissionWorkflow ||
      shouldForceClickyDesktopOperatorWorkflow ||
      shouldForceDirectDesktopWorkflow ||
      shouldForceDesktopLaunchWorkflow) &&
    permissionToolNames
      ? Array.from(
          new Set([
            ...permissionToolNames,
            "requestBrowserConnection",
            "runBrowserTask",
            "controlBrowserSession",
            "stopBrowserSession",
            "planWorkflow",
            "executeWorkflow",
            "listWorkflowTemplates",
            "getWorkflowStatus",
            "generateMedia",
          ])
        )
      : permissionToolNames;
  const hasAgentScopedMcpTools =
    Array.isArray(toolAccess.allowedMcpServerIds) &&
    toolAccess.allowedMcpServerIds.length > 0;
  // MCP discovery may launch local stdio servers, so avoid it for normal chat turns.
  const shouldLoadMcpTools =
    hasAgentScopedMcpTools ||
    blenderIntent ||
    /\bmcp\b/i.test(turnIntentText);
  const tools = !turnIntentText
    ? null
    : await createToolRegistry(
        {
          userId: user.uid,
          adminDb,
          chatId: resolvedChatId,
          projectId: resolvedProjectId,
          chatProviderModel:
            selectedProviderModel === "auto" ? null : selectedProviderModel,
          isDesktopApp,
        },
        {
          includeWebTools,
          // Local desktop/dev can spawn the browser-use runner. Hosted
          // serverless environments cannot run persistent browser sessions.
          includeBrowserTools:
            !hasScreenReadIntent &&
            (toolAccess.includeBrowserTools ||
              shouldForceBrowserTask ||
              isFullAccessMode) &&
            canUseLocalBrowserTools,
          // For Blender-intent requests, disable terminal tools so the model
          // doesn't execute bpy snippets as shell commands.
          includeTerminalTools:
            (toolAccess.includeTerminalTools || isFullAccessMode) &&
            !blenderIntent &&
            !hasScreenReadIntent,
          includeFLERBAITools:
            (shouldForceDesktopScreenshot ||
              (isDesktopApp && shouldForceDesktopPermissionWorkflow) ||
              (isDesktopApp && shouldForceClickyDesktopOperatorWorkflow) ||
              (isDesktopApp && shouldForceDirectDesktopWorkflow) ||
              (isDesktopApp && shouldForceDesktopLaunchWorkflow) ||
              (!hasScreenReadIntent &&
                (toolAccess.includeFLERBAITools ||
                  (isDesktopApp && shouldForceBrowserTask) ||
                  isFullAccessMode))) &&
            !blenderIntent,
          includeMcpTools: shouldLoadMcpTools,
          allowedToolNames: allowedToolNamesForRequest,
          allowedMcpServerIds: toolAccess.allowedMcpServerIds,
        }
      );

  const toolNames = tools ? Object.keys(tools) : [];
  const blenderToolNames = toolNames.filter((name) => /^mcp_/i.test(name) && /blender/i.test(name));

  if (blenderIntent && blenderToolNames.length === 0) {
    const assistantMessageId = crypto.randomUUID();
    const assistantText =
      "I could not execute that Blender action yet because Blender MCP tools are not available in this session. " +
      "Please ensure the desktop app is running with Blender MCP enabled and the Blender MCP add-on is connected, then retry.";
    const nowIso = new Date().toISOString();

    if (resolvedChatId) {
      try {
        await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
          chat_id: resolvedChatId,
          role: "assistant",
          content: assistantText,
          parts: [{ type: "text", text: assistantText }],
          tool_invocations: null,
          metadata: {
            model: selectedProviderModel,
            defaultModel: modelOption.providerModel,
            modelTier: aiModel,
            plan: userPlan,
            blenderExecutionBlocked: true,
            ...(resolvedAgent
              ? {
                  agentId: resolvedAgent.id,
                  agentName: resolvedAgent.name,
                }
              : {}),
          },
          created_at: nowIso,
        });
      } catch (error) {
        log.error("Failed to persist Blender blocked response:", error);
      }
    }

    return createTextChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      text: assistantText,
    });
  }

  if (shouldForceMediaGeneration && mediaGenerationIntent && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const toolName = "generateMedia";
    const toolCallId = `${toolName}-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const toolInput = {
      mode: mediaGenerationIntent.mode,
      prompt: mediaGenerationIntent.prompt,
      aspectRatio: mediaGenerationIntent.aspectRatio,
      ...(mediaGenerationIntent.mode === "image-edit"
        ? { inputImageCount: latestUserImageSources.length }
        : {}),
    };
    const toolExecutionInput = {
      ...toolInput,
      ...(mediaGenerationIntent.mode === "image-edit"
        ? { inputImages: latestUserImageSources }
        : {}),
    };
    const directActionTools = tools as
      | Record<
          string,
          {
            execute?: (
              input: Record<string, unknown>,
              options: { toolCallId: string; messages: typeof outboundModelMessages }
            ) => Promise<unknown>;
          }
        >
      | null;

    let toolOutput: unknown;
    if (directActionTools?.generateMedia?.execute) {
      try {
        toolOutput = await directActionTools.generateMedia.execute(toolExecutionInput, {
          toolCallId,
          messages: outboundModelMessages,
        });
      } catch (error) {
        toolOutput = {
          ok: false,
          mode: mediaGenerationIntent.mode,
          prompt: mediaGenerationIntent.prompt,
          message: getReadableErrorMessage(error, "Failed to generate media."),
        };
      }
    } else {
      toolOutput = {
        ok: false,
        mode: mediaGenerationIntent.mode,
        prompt: mediaGenerationIntent.prompt,
        message: "Media generation is not enabled for this chat.",
      };
    }

    if (
      mediaGenerationIntent.presentation === "design" &&
      isRecord(toolOutput) &&
      toolOutput.ok !== false
    ) {
      toolOutput = {
        ...toolOutput,
        presentation: "design",
        originalPrompt: effectiveUserText,
        designSummary: buildDesignMediaResultCopy(
          effectiveUserText,
          mediaGenerationIntent.prompt
        ),
      };
    }

    const toolOutputRecord = isRecord(toolOutput) ? toolOutput : null;
    const toolFailed =
      toolOutputRecord?.ok === false || toolOutputRecord?.type === "error";
    const failureMessage =
      typeof toolOutputRecord?.message === "string"
        ? toolOutputRecord.message
        : typeof toolOutputRecord?.error === "string"
          ? toolOutputRecord.error
          : "Media generation returned an error.";
    const assistantText = toolFailed
      ? `I couldn't generate the ${mediaGenerationIntent.mode}: ${failureMessage}`
      : "";
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName,
        args: toolInput,
        providerExecuted: true,
      },
      {
        type: "tool-result",
        toolCallId,
        toolName,
        result: toolOutput,
        providerExecuted: true,
      },
    ];

    if (assistantText) {
      assistantContent.push({
        type: "text",
        text: assistantText,
      });
    }

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText || null,
        parts: normalizeStoredParts(assistantContent),
        tool_invocations: [
          {
            toolName,
            args: toolInput,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          manualMediaGeneration: true,
          ...(mediaGenerationIntent.presentation === "design"
            ? { manualDesignGeneration: true }
            : {}),
          ...(toolFailed
            ? {
                toolErrors: [
                  {
                    toolName,
                    errorCode: "MEDIA_GENERATION_ERROR",
                    message: failureMessage,
                  },
                ],
              }
            : {}),
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save deterministic media response:", error);
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName,
      input: toolInput,
      output: toolOutput,
      text: assistantText,
      providerExecuted: true,
    });
  }

  if (shouldForceDesktopPermissionWorkflow && desktopPermissionIntent && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const toolName = "planWorkflow";
    const toolCallId = `${toolName}-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const metadata: Record<string, unknown> = {
      model: selectedProviderModel,
      defaultModel: modelOption.providerModel,
      modelTier: aiModel,
      plan: userPlan,
      desktopPermissionIntent: desktopPermissionIntent.kind,
      desktopPlatform,
      ...(resolvedAgent
        ? {
            agentId: resolvedAgent.id,
            agentName: resolvedAgent.name,
          }
        : {}),
    };
    let assistantText = "";
    let assistantContent: Array<Record<string, unknown>> = [];
    let toolInput: Record<string, unknown> | null = null;
    let toolOutput: unknown = null;

    if (!isDesktopApp) {
      assistantText =
        "Microphone permission fixes require the Rearvy desktop app. Open this chat in Rearvy Desktop, then ask me to fix the microphone again.";
      metadata.desktopPermissionBlocked = "desktop_app_required";
    } else if (!isFullAccessMode) {
      assistantText =
        "I can prepare a microphone permission workflow, but desktop automation is not enabled for this chat yet. Reopen Rearvy Desktop or open the Desktop Workspace, then send the request again.";
      metadata.desktopPermissionBlocked = "full_access_required";
    } else if (!canUseWindowsMicrophonePermissionWorkflow(desktopPlatform)) {
      assistantText =
        "The guided microphone permission workflow is Windows-only in this version. Open your system privacy settings and allow microphone access for Rearvy, then retry the mic button.";
      metadata.desktopPermissionBlocked = "unsupported_platform";
    } else {
      toolInput = buildWindowsMicrophonePermissionWorkflow();
      const directActionTools = tools as
        | Record<
            string,
            {
              execute?: (
                input: Record<string, unknown>,
                options: { toolCallId: string; messages: typeof outboundModelMessages }
              ) => Promise<unknown>;
            }
          >
        | null;

      if (directActionTools?.planWorkflow?.execute) {
        toolOutput = await directActionTools.planWorkflow.execute(toolInput, {
          toolCallId,
          messages: outboundModelMessages,
        });
      } else {
        toolOutput = {
          type: "error",
          error: "Desktop workflow automation is not enabled.",
        };
      }

      const toolOutputRecord = isRecord(toolOutput) ? toolOutput : null;
      const toolFailed =
        toolOutputRecord?.ok === false || toolOutputRecord?.type === "error";
      assistantText = toolFailed
        ? `I couldn't prepare the microphone permission workflow: ${
            typeof toolOutputRecord?.error === "string"
              ? toolOutputRecord.error
              : "Desktop workflow automation returned an error."
          }`
        : "I prepared a microphone permission workflow. Approve it in the Desktop Workspace, enable microphone access for desktop apps/Rearvy in Windows Settings, then retry the mic button.";
      metadata.manualDesktopPermissionWorkflow = true;
      if (toolFailed) {
        metadata.toolErrors = [
          {
            toolName,
            errorCode: "DESKTOP_PERMISSION_WORKFLOW_ERROR",
            message:
              typeof toolOutputRecord?.error === "string"
                ? toolOutputRecord.error
                : "Desktop workflow automation returned an error.",
          },
        ];
      }
      assistantContent = [
        {
          type: "tool-call",
          toolCallId,
          toolName,
          args: toolInput,
        },
        {
          type: "tool-result",
          toolCallId,
          toolName,
          result: toolOutput,
        },
      ];
    }

    assistantContent.push({
      type: "text",
      text: assistantText,
    });

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText,
        parts: normalizeStoredParts(assistantContent),
        tool_invocations: toolInput
          ? [
              {
                toolName,
                args: toolInput,
              },
            ]
          : null,
        metadata,
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save desktop permission assistant message:", error);
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName,
      input: toolInput ?? undefined,
      output: toolInput ? toolOutput : undefined,
      text: assistantText,
    });
  }

  if (isCapabilityQuestion(effectiveUserText) && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const assistantText = buildCapabilityResponse({
      toolNames,
      isDesktopApp,
      isFullAccessMode,
      connectedIntegrations: promptContext.integrations,
    });
    const nowIso = new Date().toISOString();

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText,
        parts: [{ type: "text", text: assistantText }],
        tool_invocations: null,
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          deterministicCapabilityResponse: true,
          enabledToolCount: toolNames.length,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save deterministic capability response:", error);
    }

    return createTextChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      text: assistantText,
    });
  }

  const gmailComposeIntent = effectiveUserText
    ? detectGmailComposeIntent(effectiveUserText, {
        businessName: promptContext.profile?.business_name,
      })
    : null;

  if (shouldForceTradingTool && tradingPairIntent && tools && resolvedChatId) {
    const toolCallId = `getTradingOpinion-${crypto.randomUUID()}`;
    const assistantMessageId = crypto.randomUUID();
    const tradingToolInput = {
      symbol: tradingPairIntent.symbol,
      timeframe: tradingPairIntent.timeframe,
    };
    const getTradingOpinionExecute = tools.getTradingOpinion.execute as
      | DirectToolExecute<TradingOpinionToolInput>
      | undefined;
    if (!getTradingOpinionExecute) {
      return new Response(
        JSON.stringify({ error: "Trading opinion tool is unavailable." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const tradingToolOutput = await getTradingOpinionExecute(tradingToolInput, {
      toolCallId,
      messages: outboundModelMessages,
    });
    const assistantText = buildTradingOpinionSummary(tradingToolOutput);
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName: "getTradingOpinion",
        args: tradingToolInput,
      },
      {
        type: "tool-result",
        toolCallId,
        toolName: "getTradingOpinion",
        result: tradingToolOutput,
      },
    ];

    if (assistantText) {
      assistantContent.push({
        type: "text",
        text: assistantText,
      });
    }

    const nowIso = new Date().toISOString();
    const storedParts = normalizeStoredParts(assistantContent);
    const tradingToolOutputRecord: Record<string, unknown> | null =
      isRecord(tradingToolOutput) ? tradingToolOutput : null;
    const toolErrors =
      typeof tradingToolOutputRecord?.error === "string"
        ? [
            {
              toolName: "getTradingOpinion",
              errorCode: tradingToolOutputRecord.error,
              message:
                typeof tradingToolOutputRecord.errorDetails === "string"
                  ? tradingToolOutputRecord.errorDetails
                  : "Trading opinion returned a fallback response.",
            },
          ]
        : [];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText || null,
        parts: storedParts,
        tool_invocations: [
          {
            toolName: "getTradingOpinion",
            args: tradingToolInput,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualTradingOpinion: true,
          ...(toolErrors.length > 0 ? { toolErrors } : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save manual trading assistant message:", error);
    }

    if (assistantText) {
      void import("@/lib/ai/mempalace").then(({ captureMempalaceConversation }) =>
        captureMempalaceConversation({
          userId: user.uid,
          chatId: resolvedChatId,
          projectId: resolvedProjectId,
          agentId: resolvedAgentId,
          userMessage: effectiveUserText,
          assistantMessage: assistantText,
          provider: "manual-trading-tool",
          model: selectedProviderModel,
        })
      );
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName: "getTradingOpinion",
      input: tradingToolInput,
      output: tradingToolOutput,
      text: assistantText,
    });
  }

  if (shouldForceDesktopScreenshot && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const directActionTools = tools as
      | Record<
          string,
          {
            execute?: (
              input: Record<string, unknown>,
              options: { toolCallId: string; messages: typeof outboundModelMessages }
            ) => Promise<unknown>;
          }
        >
      | null;
    const toolName = "planWorkflow";
    const toolCallId = `${toolName}-${crypto.randomUUID()}`;
    const toolInput = {
      description: `Capture a desktop screenshot for the user's request: ${effectiveUserText}`,
      name: "Capture screenshot",
      steps: [
        {
          id: "step_screenshot",
          name: "Capture screenshot",
          action: { type: "screenshot", analyze: false },
          timeout: 5000,
        },
      ],
    };

    let toolOutput: unknown;
    if (!isDesktopApp) {
      toolOutput = {
        type: "error",
        error: "Screenshot capture requires the Rearvy desktop app.",
      };
    } else if (directActionTools?.planWorkflow?.execute) {
      toolOutput = await directActionTools.planWorkflow.execute(toolInput, {
        toolCallId,
        messages: outboundModelMessages,
      });
    } else {
      toolOutput = {
        type: "error",
        error: "Desktop screenshot workflow automation is not enabled.",
      };
    }

    const toolOutputRecord = isRecord(toolOutput) ? toolOutput : null;
    const toolFailed =
      toolOutputRecord?.ok === false || toolOutputRecord?.type === "error";
    const assistantText = toolFailed
      ? `I couldn't prepare the screenshot workflow: ${
          typeof toolOutputRecord?.error === "string"
            ? toolOutputRecord.error
            : "Desktop screenshot automation returned an error."
        }`
      : "I prepared a desktop screenshot workflow. Approve it in the Desktop Workspace to capture the screen.";
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName,
        args: toolInput,
      },
      {
        type: "tool-result",
        toolCallId,
        toolName,
        result: toolOutput,
      },
      {
        type: "text",
        text: assistantText,
      },
    ];
    const nowIso = new Date().toISOString();
    const storedParts = normalizeStoredParts(assistantContent);
    const toolErrors =
      toolFailed
        ? [
            {
              toolName,
              errorCode: "DESKTOP_SCREENSHOT_ERROR",
              message:
                typeof toolOutputRecord?.error === "string"
                  ? toolOutputRecord.error
                  : "Desktop screenshot automation returned an error.",
            },
          ]
        : [];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText || null,
        parts: storedParts,
        tool_invocations: [
          {
            toolName,
            args: toolInput,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualDesktopScreenshot: true,
          ...(toolErrors.length > 0 ? { toolErrors } : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save manual screenshot assistant message:", error);
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName,
      input: toolInput,
      output: toolOutput,
      text: assistantText,
    });
  }

  if (
    (shouldForceClickyDesktopOperatorWorkflow || shouldForceDirectDesktopWorkflow) &&
    resolvedChatId
  ) {
    const isClickyDesktopWorkflow = shouldForceClickyDesktopOperatorWorkflow;
    const workflowLabel = isClickyDesktopWorkflow
      ? "Maria desktop workflow"
      : "desktop workflow";
    const assistantMessageId = crypto.randomUUID();
    const toolName = "planWorkflow";
    const toolCallId = `${toolName}-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const metadata: Record<string, unknown> = {
      model: selectedProviderModel,
      defaultModel: modelOption.providerModel,
      modelTier: aiModel,
      plan: userPlan,
      desktopWorkflow: true,
      ...(isClickyDesktopWorkflow
        ? { clickyDesktopOperatorWorkflow: true }
        : { directDesktopWorkflow: true }),
      ...(resolvedAgent
        ? {
            agentId: resolvedAgent.id,
            agentName: resolvedAgent.name,
          }
        : {}),
    };
    const assistantContent: Array<Record<string, unknown>> = [];
    let assistantText = "";
    let toolInput: Record<string, unknown> | null = null;
    let toolOutput: unknown = null;

    if (!isDesktopApp) {
      assistantText = isClickyDesktopWorkflow
        ? "Maria desktop app control requires the Rearvy desktop app. Open this chat in Rearvy Desktop, then ask me again."
        : "Desktop file, folder, and command workflows require the Rearvy desktop app. Open this chat in Rearvy Desktop, then ask me again.";
      metadata.desktopWorkflowBlocked = "desktop_app_required";
    } else if (!isFullAccessMode) {
      assistantText = isClickyDesktopWorkflow
        ? "Maria can prepare app-control and screenshot workflows, but desktop automation is not enabled for this chat yet. Reopen Rearvy Desktop or open the Desktop Workspace, then send the request again."
        : "I can prepare file, folder, and command workflows, but desktop automation is not enabled for this chat yet. Reopen Rearvy Desktop or open the Desktop Workspace, then send the request again.";
      metadata.desktopWorkflowBlocked = "full_access_required";
    } else {
      toolInput = desktopWorkflowInputToRecord(
        isClickyDesktopWorkflow
          ? buildClickyDesktopOperatorWorkflow(effectiveUserText)
          : buildDirectDesktopWorkflow(effectiveUserText)
      );
      const directActionTools = tools as
        | Record<
            string,
            {
              execute?: (
                input: Record<string, unknown>,
                options: { toolCallId: string; messages: typeof outboundModelMessages }
              ) => Promise<unknown>;
            }
          >
        | null;

      if (directActionTools?.planWorkflow?.execute) {
        toolOutput = await directActionTools.planWorkflow.execute(toolInput, {
          toolCallId,
          messages: outboundModelMessages,
        });
      } else {
        toolOutput = {
          type: "error",
          error: "Desktop workflow automation is not enabled.",
        };
      }

      const toolOutputRecord = isRecord(toolOutput) ? toolOutput : null;
      const toolFailed =
        toolOutputRecord?.ok === false || toolOutputRecord?.type === "error";
      assistantText = toolFailed
        ? `I couldn't prepare the ${workflowLabel}: ${
            typeof toolOutputRecord?.error === "string"
              ? toolOutputRecord.error
              : "Desktop workflow automation returned an error."
          }`
        : isClickyDesktopWorkflow
          ? "I prepared a Maria desktop workflow with app opening and screenshot evidence steps. Approve it in the Desktop Workspace to run it."
          : "I prepared a desktop workflow for that request. Approve it in the Desktop Workspace to run it.";
      if (isClickyDesktopWorkflow) {
        metadata.manualClickyDesktopOperatorWorkflow = true;
      } else {
        metadata.deterministicDesktopWorkflow = true;
      }

      if (toolFailed) {
        metadata.toolErrors = [
          {
            toolName,
            errorCode: isClickyDesktopWorkflow
              ? "CLICKY_DESKTOP_WORKFLOW_ERROR"
              : "DIRECT_DESKTOP_WORKFLOW_ERROR",
            message:
              typeof toolOutputRecord?.error === "string"
                ? toolOutputRecord.error
                : "Desktop workflow automation returned an error.",
          },
        ];
      }

      assistantContent.push(
        {
          type: "tool-call",
          toolCallId,
          toolName,
          args: toolInput,
        },
        {
          type: "tool-result",
          toolCallId,
          toolName,
          result: toolOutput,
        }
      );
    }

    assistantContent.push({
      type: "text",
      text: assistantText,
    });

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText || null,
        parts: normalizeStoredParts(assistantContent),
        tool_invocations: toolInput
          ? [
              {
                toolName,
                args: toolInput,
              },
            ]
          : null,
        metadata,
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error(`Failed to save ${workflowLabel} response:`, error);
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName,
      input: toolInput ?? undefined,
      output: toolInput ? toolOutput : undefined,
      text: assistantText,
    });
  }

  if (shouldForceDesktopLaunchWorkflow && desktopLaunchIntent && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const toolName = "planWorkflow";
    const toolCallId = `${toolName}-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const metadata: Record<string, unknown> = {
      model: selectedProviderModel,
      defaultModel: modelOption.providerModel,
      modelTier: aiModel,
      plan: userPlan,
      desktopLaunchKind: desktopLaunchIntent.kind,
      desktopLaunchTarget: desktopLaunchIntent.target,
      ...(resolvedAgent
        ? {
            agentId: resolvedAgent.id,
            agentName: resolvedAgent.name,
          }
        : {}),
    };
    const assistantContent: Array<Record<string, unknown>> = [];
    let assistantText = "";
    let toolInput: Record<string, unknown> | null = null;
    let toolOutput: unknown = null;

    if (!isDesktopApp) {
      assistantText =
        "Opening local apps or the browser requires the Rearvy desktop app. Open this chat in Rearvy Desktop, then ask me again.";
      metadata.desktopLaunchBlocked = "desktop_app_required";
    } else if (!isFullAccessMode) {
      assistantText =
        "I can open apps and the browser through an approval-gated desktop workflow, but desktop automation is not enabled for this chat yet. Reopen Rearvy Desktop or open the Desktop Workspace, then send the request again.";
      metadata.desktopLaunchBlocked = "full_access_required";
    } else {
      toolInput = desktopWorkflowInputToRecord(buildDesktopLaunchWorkflow(desktopLaunchIntent));
      const directActionTools = tools as
        | Record<
            string,
            {
              execute?: (
                input: Record<string, unknown>,
                options: { toolCallId: string; messages: typeof outboundModelMessages }
              ) => Promise<unknown>;
            }
          >
        | null;

      if (directActionTools?.planWorkflow?.execute) {
        toolOutput = await directActionTools.planWorkflow.execute(toolInput, {
          toolCallId,
          messages: outboundModelMessages,
        });
      } else {
        toolOutput = {
          type: "error",
          error: "Desktop workflow automation is not enabled.",
        };
      }

      const toolOutputRecord = isRecord(toolOutput) ? toolOutput : null;
      const toolFailed =
        toolOutputRecord?.ok === false || toolOutputRecord?.type === "error";
      assistantText = toolFailed
        ? `I couldn't prepare the desktop launch workflow: ${
            typeof toolOutputRecord?.error === "string"
              ? toolOutputRecord.error
              : "Desktop workflow automation returned an error."
          }`
        : `I prepared a desktop workflow to open ${desktopLaunchIntent.label}. Approve it in the Desktop Workspace to run it.`;
      metadata.manualDesktopLaunchWorkflow = true;

      if (toolFailed) {
        metadata.toolErrors = [
          {
            toolName,
            errorCode: "DESKTOP_LAUNCH_WORKFLOW_ERROR",
            message:
              typeof toolOutputRecord?.error === "string"
                ? toolOutputRecord.error
                : "Desktop workflow automation returned an error.",
          },
        ];
      }

      assistantContent.push(
        {
          type: "tool-call",
          toolCallId,
          toolName,
          args: toolInput,
        },
        {
          type: "tool-result",
          toolCallId,
          toolName,
          result: toolOutput,
        }
      );
    }

    assistantContent.push({
      type: "text",
      text: assistantText,
    });

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText || null,
        parts: normalizeStoredParts(assistantContent),
        tool_invocations: toolInput
          ? [
              {
                toolName,
                args: toolInput,
              },
            ]
          : null,
        metadata,
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save desktop launch workflow response:", error);
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName,
      input: toolInput ?? undefined,
      output: toolInput ? toolOutput : undefined,
      text: assistantText,
    });
  }

  if (shouldForceBrowserTask && isDesktopApp && resolvedChatId) {
    const connectionStatus = getBrowserConnectionStatus(
      latestBrowserConnectionOutput
    );

    if (connectionStatus === "skipped" || connectionStatus === "failed") {
      const assistantMessageId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const modelOption = resolveChatModelOption(aiModel);
      const selectedProviderModel = resolveChatProviderModel(aiModel, {
        hasImageInput: messages.some((message) => messageHasImageParts(message)),
      });
      const assistantText =
        connectionStatus === "skipped"
          ? "I will not continue the browser task because the browser connection was skipped."
          : "I could not continue the browser task because a supported browser is not connected.";

      try {
        await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
          chat_id: resolvedChatId,
          role: "assistant",
          content: assistantText,
          parts: normalizeStoredParts([{ type: "text", text: assistantText }]),
          metadata: {
            model: selectedProviderModel,
            defaultModel: modelOption.providerModel,
            modelTier: aiModel,
            plan: userPlan,
            manualBrowserConnection: true,
          },
          created_at: nowIso,
        });
        await adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId).update({
          updated_at: nowIso,
        });
      } catch (error) {
        log.error("Failed to save browser connection stop message:", error);
      }

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          const textId = crypto.randomUUID();
          writer.write({
            type: "start",
            messageId: assistantMessageId,
            messageMetadata: { chatId: resolvedChatId },
          });
          writer.write({ type: "start-step" });
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: assistantText });
          writer.write({ type: "text-end", id: textId });
          writer.write({ type: "finish-step" });
          writer.write({
            type: "finish",
            finishReason: "stop",
            messageMetadata: { chatId: resolvedChatId },
          });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    if (connectionStatus !== "connected") {
      const assistantMessageId = crypto.randomUUID();
      const toolCallId = `requestBrowserConnection-${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      const modelOption = resolveChatModelOption(aiModel);
      const selectedProviderModel = resolveChatProviderModel(aiModel, {
        hasImageInput: messages.some((message) => messageHasImageParts(message)),
      });
      const requestInput = {
        task: browserTaskText,
        reason:
          "Rearvy needs a connected browser before it can continue this browser task.",
        preferredMethod: "cdp-direct",
        allowedMethods: ["cdp-direct", "extension-relay"],
        requireFunctionalControl: true,
      };
      const assistantContent: Array<Record<string, unknown>> = [
        {
          type: "tool-call",
          toolCallId,
          toolName: "requestBrowserConnection",
          args: requestInput,
        },
      ];

      try {
        await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
          chat_id: resolvedChatId,
          role: "assistant",
          content: null,
          parts: normalizeStoredParts(assistantContent),
          tool_invocations: [
            {
              toolName: "requestBrowserConnection",
              args: requestInput,
            },
          ],
          metadata: {
            model: selectedProviderModel,
            defaultModel: modelOption.providerModel,
            modelTier: aiModel,
            plan: userPlan,
            manualBrowserConnection: true,
            ...(resolvedAgent
              ? {
                  agentId: resolvedAgent.id,
                  agentName: resolvedAgent.name,
                }
              : {}),
          },
          created_at: nowIso,
        });

        await updateChatAfterAssistantMessage({
          chatId: resolvedChatId,
          nowIso,
          titleSource: browserTaskText || effectiveUserText || userMessageSummary,
        });
      } catch (error) {
        log.error("Failed to save browser connection assistant message:", error);
      }

      return createToolChatStreamResponse({
        chatId: resolvedChatId,
        messageId: assistantMessageId,
        toolCallId,
        toolName: "requestBrowserConnection",
        input: requestInput,
      });
    }
  }

  if (
    shouldForceBrowserTask &&
    isBrowserConnectionContinuation &&
    resolvedChatId &&
    latestBrowserConnectionInfo
  ) {
    const connectionToolCallId = latestBrowserConnectionInfo.toolCallId;
    const alreadyStarted =
      hasBrowserTaskForConnection(
        messages as IncomingMessage[],
        connectionToolCallId
      ) ||
      hasBrowserAutomationAfterPosition(
        messages as IncomingMessage[],
        latestBrowserConnectionInfo.messageIndex,
        latestBrowserConnectionInfo.partIndex
      );

    if (alreadyStarted) {
      return createSilentChatResponse(resolvedChatId);
    }

    if (connectionToolCallId) {
      const claimed = await claimBrowserTaskForConnection(
        resolvedChatId,
        connectionToolCallId
      );

      if (!claimed) {
        return createSilentChatResponse(resolvedChatId);
      }
    }
  }

  if (shouldForceBrowserTask && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const startUrl = inferQuickStartUrl(browserTaskText);
    const targetLabel = startUrl
      ? describeQuickOpenTarget(null, startUrl)
      : "the requested page";
    const browserTaskInstruction = buildBrowserTaskInstruction({
      userText: browserTaskText,
      startUrl,
      targetLabel,
    });
    const directActionTools = tools as
      | Record<
          string,
          {
            execute?: (
              input: Record<string, unknown>,
              options: { toolCallId: string; messages: typeof outboundModelMessages }
            ) => Promise<unknown>;
          }
        >
      | null;
    const useDesktopWorkflow = false;
    const toolName = useDesktopWorkflow ? "planWorkflow" : "runBrowserTask";
    const toolCallId = `${toolName}-${crypto.randomUUID()}`;
    const browserConnectionToolCallId = isBrowserConnectionContinuation
      ? latestBrowserConnectionInfo?.toolCallId ?? null
      : null;
    const browserTaskDedupeKey = buildBrowserTaskDedupeKey({
      chatId: resolvedChatId,
      userMessageId:
        typeof effectiveUserMessage?.id === "string"
          ? effectiveUserMessage.id
          : null,
      connectionToolCallId: browserConnectionToolCallId,
      task: browserTaskInstruction,
    });
    const toolInput = useDesktopWorkflow
      ? {
          description: `Open ${targetLabel} at ${startUrl}.`,
          name: `Open ${targetLabel}`,
          steps: [
            {
              id: "step_open_url",
              name: `Open ${targetLabel}`,
              action: {
                type: "launchApp",
                appPath: startUrl,
                wait: true,
              },
              timeout: 10000,
            },
          ],
        }
      : {
          task: browserTaskInstruction,
          connectionMethod:
            typeof latestBrowserConnectionOutput?.method === "string"
              ? latestBrowserConnectionOutput.method
              : "auto",
          strategy: "goal-seeking",
          dedupeKey: browserTaskDedupeKey,
          ...(browserConnectionToolCallId
            ? { browserConnectionToolCallId }
            : {}),
        };
    let toolOutput: unknown;

    const executeTool = useDesktopWorkflow
      ? directActionTools?.planWorkflow?.execute
      : directActionTools?.runBrowserTask?.execute;

    if (executeTool) {
      try {
        toolOutput = await executeTool(toolInput, {
          toolCallId,
          messages: outboundModelMessages,
        });
      } catch (error) {
        toolOutput = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      toolOutput = {
        ok: false,
        error: useDesktopWorkflow
          ? "Desktop workflow automation is not enabled for this agent."
          : canUseLocalBrowserTools
          ? "Browser automation is not enabled for this agent."
          : "Browser automation is only available in the local Rearvy desktop/dev runtime.",
      };
    }

    const toolOutputRecord = isRecord(toolOutput)
      ? toolOutput
      : null;
    const toolFailed =
      toolOutputRecord?.ok === false || toolOutputRecord?.type === "error";
    const toolReused =
      !toolFailed && toolOutputRecord?.reused === true;

    if (toolReused) {
      return createSilentChatResponse(resolvedChatId);
    }

    if (toolFailed && browserConnectionToolCallId) {
      releaseBrowserTaskForConnection(resolvedChatId, browserConnectionToolCallId).catch(
        (error) => {
          log.error("Failed to release browser task dedupe marker:", error);
        }
      );
    }

    const assistantText = toolFailed
      ? `I couldn't start ${
          useDesktopWorkflow ? "the desktop workflow" : "the browser session"
        }: ${
          typeof toolOutputRecord?.error === "string"
            ? toolOutputRecord.error
            : `${useDesktopWorkflow ? "Desktop workflow" : "Browser automation"} returned an error.`
        }`
      : useDesktopWorkflow
        ? `I prepared a desktop workflow to open ${targetLabel}. Approve it in the Desktop Workspace to run it.`
        : buildBrowserExecutionSummary({
            targetLabel,
            browserTaskInstruction,
            toolOutput: toolOutputRecord,
            signupAccountIdentifierState,
          });
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName,
        args: toolInput,
      },
      {
        type: "tool-result",
        toolCallId,
        toolName,
        result: toolOutput,
      },
      ...(assistantText
        ? [
            {
              type: "text",
              text: assistantText,
            },
          ]
        : []),
    ];
    const nowIso = new Date().toISOString();
    const storedParts = normalizeStoredParts(assistantContent);
    const toolErrors =
      toolFailed
        ? [
            {
              toolName,
              errorCode: useDesktopWorkflow
                ? "DESKTOP_WORKFLOW_ERROR"
                : "BROWSER_TASK_ERROR",
              message:
                typeof toolOutputRecord?.error === "string"
                  ? toolOutputRecord.error
                  : `${useDesktopWorkflow ? "Desktop workflow" : "Browser automation"} returned an error.`,
            },
          ]
        : [];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText || null,
        parts: storedParts,
        tool_invocations: [
          {
            toolName,
            args: toolInput,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualBrowserTask: !useDesktopWorkflow,
          manualDesktopWorkflow: useDesktopWorkflow,
          ...(browserConnectionToolCallId
            ? { browserConnectionToolCallId }
            : {}),
          ...(toolErrors.length > 0 ? { toolErrors } : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: browserTaskText || effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save manual browser assistant message:", error);
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName,
      input: toolInput,
      output: toolOutput,
      text: assistantText,
    });
  }

  if (gmailComposeIntent?.kind === "needs-recipient" && resolvedChatId) {
    const assistantMessageId = crypto.randomUUID();
    const assistantText = gmailComposeIntent.message;
    const nowIso = new Date().toISOString();

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: assistantText,
        parts: [{ type: "text", text: assistantText }],
        tool_invocations: null,
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualGmailCompose: true,
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save Gmail recipient follow-up:", error);
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const textId = `text-${assistantMessageId}`;
        writer.write({
          type: "start",
          messageId: assistantMessageId,
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
        writer.write({ type: "start-step" });
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: assistantText });
        writer.write({ type: "text-end", id: textId });
        writer.write({ type: "finish-step" });
        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            chatId: resolvedChatId,
          },
        });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  if (gmailComposeIntent?.kind === "compose" && tools && resolvedChatId) {
    const toolCallId = `prepareGmailMessage-${crypto.randomUUID()}`;
    const assistantMessageId = crypto.randomUUID();
    const prepareGmailMessageExecute = tools.prepareGmailMessage.execute as
      | DirectToolExecute<GmailComposeToolInput>
      | undefined;
    if (!prepareGmailMessageExecute) {
      return new Response(
        JSON.stringify({ error: "Gmail compose tool is unavailable." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const gmailToolOutput = await prepareGmailMessageExecute(
      gmailComposeIntent.input,
      {
        toolCallId,
        messages: outboundModelMessages,
      }
    );
    const assistantContent: Array<Record<string, unknown>> = [
      {
        type: "tool-call",
        toolCallId,
        toolName: "prepareGmailMessage",
        args: gmailComposeIntent.input,
      },
      {
        type: "tool-result",
        toolCallId,
        toolName: "prepareGmailMessage",
        result: gmailToolOutput,
      },
    ];

    const nowIso = new Date().toISOString();
    const storedParts = normalizeStoredParts(assistantContent);
    const gmailToolOutputRecord: Record<string, unknown> | null = isRecord(gmailToolOutput)
      ? gmailToolOutput
      : null;
    const toolErrors =
      gmailToolOutputRecord?.ok === false
        ? [
            {
              toolName: "prepareGmailMessage",
              errorCode:
                typeof gmailToolOutputRecord["errorCode"] === "string"
                  ? gmailToolOutputRecord["errorCode"]
                  : "TOOL_ERROR",
              message:
                typeof gmailToolOutputRecord["message"] === "string"
                  ? gmailToolOutputRecord["message"]
                  : "Gmail compose failed.",
            },
          ]
        : [];

    try {
      await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
        chat_id: resolvedChatId,
        role: "assistant",
        content: null,
        parts: storedParts,
        tool_invocations: [
          {
            toolName: "prepareGmailMessage",
            args: gmailComposeIntent.input,
          },
        ],
        metadata: {
          model: selectedProviderModel,
          defaultModel: modelOption.providerModel,
          modelTier: aiModel,
          plan: userPlan,
          ...(resolvedAgent
            ? {
                agentId: resolvedAgent.id,
                agentName: resolvedAgent.name,
              }
            : {}),
          manualGmailCompose: true,
          ...(toolErrors.length > 0 ? { toolErrors } : {}),
        },
        created_at: nowIso,
      });

      await updateChatAfterAssistantMessage({
        chatId: resolvedChatId,
        nowIso,
        titleSource: effectiveUserText || userMessageSummary,
      });
    } catch (error) {
      log.error("Failed to save Gmail compose assistant message:", error);
    }

    return createToolChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      toolCallId,
      toolName: "prepareGmailMessage",
      input: gmailComposeIntent.input,
      output: gmailToolOutput,
    });
  }

  const routedModel = await resolveModelForChat({
    providerId:
      modelOption.provider === "nvidia" && selectedProviderModel !== "auto"
        ? "nvidia"
        : null,
    requestedProviderModel:
      selectedProviderModel === "auto" ? null : selectedProviderModel,
    task: aiProviderTask,
    hasImageInput,
    isDesktopApp,
    autoRoute: aiModel === "auto",
    routingText: turnIntentText || effectiveUserText,
    routingMode: thinkingMode ? "quality" : "fast",
    maxCostTier: thinkingMode ? "premium" : undefined,
  });
  const selectedModel = routedModel.model;
  const modelRoute = routedModel.decision;
  const publicModelRoute = sanitizeModelRouteForClient(modelRoute);
  const resolvedProviderModel = modelRoute.providerModel ?? selectedProviderModel;
  const providerOptions = buildProviderOptionsForRoute({
    providerId: modelRoute.providerId,
    providerModel: resolvedProviderModel,
    enableReasoning: thinkingMode,
  });
  const maxOutputTokens =
    thinkingMode && isNvidiaNemotronReasoningModel(resolvedProviderModel)
      ? 65536
      : thinkingMode
        ? 12288
        : 8192;

  if (!selectedModel) {
    const assistantMessageId = crypto.randomUUID();
    const assistantText = buildNoModelConfiguredMessage();
    const nowIso = new Date().toISOString();

    if (resolvedChatId) {
      try {
        await adminDb.collection(COLLECTIONS.MESSAGES).doc(assistantMessageId).set({
          chat_id: resolvedChatId,
          role: "assistant",
          content: assistantText,
          parts: [{ type: "text", text: assistantText }],
          tool_invocations: null,
          metadata: {
            model: selectedProviderModel,
            defaultModel: modelOption.providerModel,
            modelTier: aiModel,
            plan: userPlan,
            modelRoute: publicModelRoute,
            aiUnavailable: true,
            ...(resolvedAgent
              ? {
                  agentId: resolvedAgent.id,
                  agentName: resolvedAgent.name,
                }
              : {}),
          },
          created_at: nowIso,
        });

        await adminDb
          .collection(COLLECTIONS.CHATS)
          .doc(resolvedChatId)
          .update({ updated_at: nowIso });
      } catch (error) {
        log.error("Failed to persist no-model fallback response:", error);
      }
    }

    return createTextChatStreamResponse({
      chatId: resolvedChatId,
      messageId: assistantMessageId,
      text: assistantText,
    });
  }

  const baseSystemPrompt = buildSystemPrompt({
    context: promptContext,
    agent: resolvedAgent,
    webResearchMode: includeWebTools ? "tools" : "none",
    responseMode: "deep",
    isDesktopApp,
    desktopToolContext: {
      hasDesktopWorkflowTools:
        toolNames.includes("planWorkflow") || toolNames.includes("executeWorkflow"),
      hasBrowserTools:
        toolNames.includes("runBrowserTask") ||
        toolNames.includes("controlBrowserSession"),
      hasTerminalTools:
        toolNames.includes("listDirectory") ||
        toolNames.includes("readFile") ||
        toolNames.includes("runTerminalCommand"),
      hasBlenderMcpTools: blenderToolNames.length > 0,
      hasExternalMcpTools: toolNames.some((name) => /^mcp_/i.test(name)),
    },
  });
  const permissionContext = isFullAccessMode
    ? "Desktop tool access is enabled in this desktop chat. You may use enabled desktop, browser, and terminal tools when appropriate, but you must still obey all approval gates, safety blocks, and user instructions. For device permission issues such as microphone, camera, audio capture, browser permission popups, or visible OS settings, use desktop workflow tools when enabled instead of saying you cannot access the computer. Do not claim desktop work is complete before the Desktop Workspace approval flow runs."
    : "Desktop tool access is limited. Prefer sandboxed, read-only, scoped-folder, or approval-gated actions. Do not assume unrestricted access to the user's computer.";
  const thinkingContext = thinkingMode
    ? "Thinking mode is enabled. Work deliberately, inspect the available context, verify the answer before finalizing, and keep going until the best solution is ready. Do not reveal chain-of-thought or private reasoning; give the user a concise answer with only the useful rationale."
    : "";
  const systemPromptWithPermissions = [
    baseSystemPrompt,
    permissionContext,
    thinkingContext,
  ]
    .filter(Boolean)
    .join("\n\n");
  const systemPrompt = mempalaceRecallContext
    ? `${systemPromptWithPermissions}\n\n${mempalaceRecallContext}`
    : systemPromptWithPermissions;

  // NVIDIA-compatible chat streaming currently fails on streamed tool-call chunks
  // for some providers, so keep the main chat turn text-only and use explicit
  // pre-call tool execution paths where we need deterministic tool usage.
  // Exception: Desktop apps with MCP tools (Blender, etc.) need streaming tool support
  const isToolCapableModel =
    isDesktopApp && !hasScreenReadIntent && tools && Object.keys(tools).length > 0;

  try {
    const traceStartedAtMs = Date.now();
    const traceStartedAtIso = new Date(traceStartedAtMs).toISOString();
    const result = streamText({
      model: selectedModel,
      maxOutputTokens,
      providerOptions,
      system: freeTierWebResearch
        ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}`
        : isToolCapableModel
          ? systemPrompt
          : `${systemPrompt}\n\nIMPORTANT: You do not have access to tools or functions. Answer the user's question using only your knowledge and any context provided. Do not attempt to call any functions or tools. If you cannot answer without data tools, explain what information is missing and suggest connecting or syncing the relevant business data.`,
      messages: outboundModelMessages,
      ...(isToolCapableModel && tools
        ? {
            tools,
            stopWhen: stepCountIs(CHAT_CONFIG.MAX_TOOL_STEPS),
            prepareStep:
              shouldForceTradingTool && tradingPairIntent
                ? ({ stepNumber }) => {
                    if (stepNumber !== 0) {
                      return undefined;
                    }

                    return {
                      activeTools: ["getTradingOpinion"],
                      toolChoice: {
                        type: "tool",
                        toolName: "getTradingOpinion",
                      },
                      system: `${freeTierWebResearch ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}` : systemPrompt}\n- For this turn, the user gave a trading symbol or pair: ${tradingPairIntent.symbol}.\n- You must call getTradingOpinion first with symbol "${tradingPairIntent.symbol}" and timeframe "${tradingPairIntent.timeframe}".\n- Do not call browser tools, do not open Binance or TradingView, and do not treat a trading pair as a website navigation request.\n- After the tool returns, explain the trade result plainly. If the result is Hold, say there is no clean trade right now.`,
                    };
                  }
                  : blenderIntent && blenderToolNames.length > 0
                  ? ({ stepNumber }) => {
                      if (stepNumber !== 0) {
                        return undefined;
                      }

                      return {
                        activeTools: blenderToolNames,
                        system: `${freeTierWebResearch ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}` : systemPrompt}\n- This user request is Blender-focused.
- Use Blender MCP tools only.
- Do NOT call runTerminalCommand for bpy, blender_mcp_*, or scene modeling actions.
- If a Blender MCP call fails, explain the specific failure and suggest bridge/add-on checks.`,
                      };
                    }
                  : shouldForceDesktopScreenshot
                    ? ({ stepNumber }) => {
                        if (stepNumber !== 0) {
                          return undefined;
                        }

                        return {
                          activeTools: ["planWorkflow"],
                          toolChoice: {
                            type: "tool",
                            toolName: "planWorkflow",
                          },
                          system: `${freeTierWebResearch ? `${systemPrompt}\n\n${freeTierWebResearch.systemAddition}` : systemPrompt}
- This turn is a desktop screenshot or screen-inspection request.
- You must call planWorkflow first with a single screenshot step.
- Use name "Capture screenshot".
- Use description "Capture a desktop screenshot for the user's request: ${effectiveUserText.replace(/`/g, "'")}".
- Use steps: [{ "id": "step_screenshot", "name": "Capture screenshot", "action": { "type": "screenshot", "analyze": false }, "timeout": 5000 }].
- After the tool returns, say that the screenshot workflow is ready for approval in the Desktop Workspace. Do not claim the screenshot has already been captured before approval.
- Never say you cannot take screenshots in desktop mode.`,
                        };
                      }
                  : undefined,
          }
        : {}),
      onFinish: async (event) => {
        if (!resolvedChatId) return;
        const traceFinishedAtMs = Date.now();
        const nowIso = new Date(traceFinishedAtMs).toISOString();
        const traceDurationMs = Math.max(0, traceFinishedAtMs - traceStartedAtMs);

        // Persist assistant messages to database defensively
        let assistantMessages: AssistantMessageRecord[] = [];
        const eventRecord: Record<string, unknown> | null = isRecord(event) ? event : null;
        const responseRecord = isRecord(eventRecord?.response) ? eventRecord.response : null;
        const responseMessages = responseRecord?.messages;
        const eventMessages = eventRecord?.messages;
        const eventMessage = isRecord(eventRecord?.message) ? eventRecord.message : null;

        if (responseMessages) {
          assistantMessages = assistantMessagesFromValue(responseMessages);
        } else if (eventMessages) {
          assistantMessages = assistantMessagesFromValue(eventMessages);
        }

        if (assistantMessages.length === 0) {
          // Construct manually from event if no assistant messages found
          const parts = fallbackToolPartsFromFinishEvent(event);
          if (parts.length > 0) {
            assistantMessages.push({
              id:
                typeof eventMessage?.id === "string"
                  ? eventMessage.id
                  : undefined,
              role: "assistant",
              content: parts,
            });
          }
        }

        for (const msg of assistantMessages) {
          const content = extractAssistantMessageText(msg.content);

          const toolInvocations = toolInvocationsFromContent(msg.content);
          const toolErrors = toolErrorsFromContent(msg.content);

          if (toolErrors.length > 0) {
            log.warn("Tool errors detected in assistant response:", toolErrors);
          }

          try {
            const storedParts = normalizeStoredParts(msg.content);
            const hasTextContent = Boolean(content && content.trim().length > 0);
            const hasStoredParts = Boolean(storedParts && storedParts.length > 0);
            if (!hasTextContent && !hasStoredParts) {
              log.warn("Skipped persisting empty assistant message", {
                chatId: resolvedChatId,
              });
              continue;
            }

            const messageId = msg.id;
            const messagePayload = {
              chat_id: resolvedChatId,
              role: "assistant",
              content: content || null,
              parts: storedParts,
              tool_invocations:
                toolInvocations.length > 0 ? toolInvocations : null,
              metadata: {
                model: resolvedProviderModel,
                defaultModel: modelOption.providerModel,
                modelTier: aiModel,
                plan: userPlan,
                modelRoute: publicModelRoute,
                traceStartedAt: traceStartedAtIso,
                traceFinishedAt: nowIso,
                traceDurationMs,
                agentName: resolvedAgent?.name ?? "Rearvy",
                ...(resolvedAgent
                  ? {
                      agentId: resolvedAgent.id,
                      agentName: resolvedAgent.name,
                    }
                  : {}),
                ...(toolErrors.length > 0 ? { toolErrors } : {}),
                ...(freeTierWebResearch
                  ? { webResearch: freeTierWebResearch.metadata }
                  : {}),
              },
              created_at: nowIso,
            };

            if (messageId) {
              await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageId).set(messagePayload);
            } else {
              await adminDb.collection(COLLECTIONS.MESSAGES).add(messagePayload);
            }
          } catch (error) {
            log.error("Failed to save assistant message:", error);
          }
        }

        const memoryTrace = buildMemoryToolTrace(assistantMessages);
        const assistantTranscript = assistantMessages
          .map((message) => extractAssistantMessageText(message.content))
          .filter(Boolean)
          .join("\n\n");

        if (
          resolvedChatId &&
          assistantTranscript &&
          shouldCreateProactiveAssistantAlert(assistantTranscript)
        ) {
          try {
            const alert = buildProactiveAssistantAlert(assistantTranscript);
            const messageId = assistantMessages[assistantMessages.length - 1]?.id ?? null;

            await createAssistantAlertRecord({
              db: adminDb,
              userId: user.uid,
              chatId: resolvedChatId,
              projectId: resolvedProjectId ?? null,
              messageId,
              title: alert.title,
              summary: alert.summary,
              messageText: alert.messageText,
              severity: alert.severity,
              source: alert.source,
            });
          } catch (error) {
            log.error("Failed to persist proactive assistant alert:", error);
          }
        }

        if (effectiveUserText && assistantTranscript) {
          void import("@/lib/ai/mempalace").then(({ captureMempalaceConversation }) =>
            captureMempalaceConversation({
              userId: user.uid,
              chatId: resolvedChatId,
              projectId: resolvedProjectId,
              agentId: resolvedAgentId,
              userMessage: effectiveUserText,
              assistantMessage: assistantTranscript,
              provider: modelRoute.providerId ?? "unavailable",
              model: resolvedProviderModel,
              trace: memoryTrace,
            })
          );
        }

        // Auto-title the chat from the first user message (only once)
        try {
          const chatRef =
            adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
          const chatSnap = await chatRef.get();
          const existingChat = chatSnap.data() as StoredChat | undefined;
          const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

          if (!existingChat?.title) {
            // Get the first user message text to use as title
            const firstUserMsg = outboundModelMessages.find((m) => m.role === "user");
            if (firstUserMsg) {
              const rawText =
                typeof firstUserMsg.content === "string"
                  ? firstUserMsg.content
                  : Array.isArray(firstUserMsg.content)
                    ? firstUserMsg.content
                      .filter((p) => p.type === "text")
                      .map((p) => ("text" in p ? p.text : ""))
                      .join(" ")
                    : "";
              // Truncate to ~60 chars for title
              const trimmed = rawText.trim() || userMessageSummary;
              const title =
                trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
              if (title) {
                chatUpdates.title = title;
              }
            }
          }

          await chatRef.update(chatUpdates);
        } catch (error) {
          log.error("Failed to update chat title:", error);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === "start") {
          return {
            chatId: resolvedChatId,
            modelRoute: publicModelRoute,
            traceStartedAt: traceStartedAtIso,
            agentName: resolvedAgent?.name ?? "Rearvy",
          };
        }

        if (part.type === "finish") {
          const traceFinishedAtMs = Date.now();
          return {
            chatId: resolvedChatId,
            modelRoute: publicModelRoute,
            traceStartedAt: traceStartedAtIso,
            traceFinishedAt: new Date(traceFinishedAtMs).toISOString(),
            traceDurationMs: Math.max(0, traceFinishedAtMs - traceStartedAtMs),
            agentName: resolvedAgent?.name ?? "Rearvy",
          };
        }

        return undefined;
      },
    });
  } catch (error) {
    log.error("Chat AI error:", error);
    const message = getReadableErrorMessage(
      error,
      "AI model failed to respond. Please try again."
    );

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  } catch (error) {
    log.error("Chat request error:", error);

    const message = getReadableErrorMessage(
      error,
      "Chat request failed. Please try again."
    );

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
