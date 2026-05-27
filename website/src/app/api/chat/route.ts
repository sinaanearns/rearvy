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
  buildBrowserTaskInstruction,
  describeQuickOpenTarget,
  inferQuickStartUrl,
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
  buildNoModelConfiguredMessage,
  inferAIProviderTask,
  resolveModelForChat,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
// mempalace functions are imported dynamically inside the POST handler to avoid unintentional project-wide NFT tracing
// import { buildMempalaceRecallContext, captureMempalaceConversation } from "@/lib/ai/mempalace";
import {
  buildStoredUserMessageParts,
  buildUserMessageSummary,
  extractIncomingMessageText,
  messageHasImageParts,
  normalizeIncomingMessagesForModel,
} from "@/lib/ai/message-parts";
import { detectGmailComposeIntent } from "@/lib/ai/gmail-compose-intent";
import { detectTradingPairIntent } from "@/lib/ai/trading-intent";
import {
  detectNativeTransferIntent,
  isUnsupportedTokenTransferIntent,
} from "@/lib/transactions/intent";
import { createTransactionRequest } from "@/lib/transactions/store";
import { DEFAULT_PLAN } from "@/lib/plans";
import { CHAT_CONFIG } from "@/lib/utils/constants";
import { detectAndProcessCommand } from "@/lib/ai/smart-commands";
import { getReadableErrorMessage } from "@/lib/error-message";
import {
  buildProactiveAssistantAlert,
  shouldCreateProactiveAssistantAlert,
} from "@/lib/assistant-alerts";
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
import type { NextRequest } from "next/server";

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
  const aiModel = resolveChatModelTier(payload?.aiModel, userPlan);
  const chatPermissionMode = normalizeChatPermissionMode(
    payload?.chatPermissionMode
  );
  const desktopPlatform = normalizeDesktopPlatform(payload?.desktopPlatform);
  const isFullAccessMode =
    isDesktopApp && chatPermissionMode === "full-access";
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
        console.error("Failed to update chat agent:", error);
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
      console.error("Failed to create chat:", error);
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
      console.error("Failed to persist user message:", error);
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
      console.error("Failed to load chat history for model replay:", error);
    }
  }

  if (effectiveUserText) {
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
      console.error("Failed to save ask-user assistant message:", error);
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
        try {
          const transactionRequest = await createTransactionRequest(adminDb, {
            userId: user.uid,
            chatId: resolvedChatId,
            projectId: resolvedProjectId,
            source: "ai_suggestion",
            toAddress: nativeTransferIntent.toAddress,
            amountEth: nativeTransferIntent.amountEth,
            reason: `AI-drafted native transfer from explicit chat request: ${nativeTransferIntent.reason}`,
            riskSummary:
              "Native EVM transfer draft only. User approval in Rearvy and MetaMask confirmation are required before funds move. Rearvy never handles private keys.",
          });

          assistantText = [
            "I created a MetaMask transaction draft only.",
            "",
            `Amount: ${transactionRequest.human_amount || transactionRequest.amount_display}`,
            `To: ${transactionRequest.to_address}`,
            transactionRequest.from_address
              ? `From: ${transactionRequest.from_address}`
              : "From: connect MetaMask before submission",
            transactionRequest.chain_id
              ? `Chain: ${transactionRequest.network_name || transactionRequest.chain_id}`
              : "Chain: current MetaMask chain at submission",
            "",
            "Status: awaiting approval. Review it in Operations Console > Approvals. I did not submit anything, and MetaMask will only be used after you approve the draft and confirm the wallet prompt.",
          ].join("\n");

          metadata.transactionDraft = true;
          metadata.transactionRequestId = transactionRequest.id;
          metadata.transactionStatus = transactionRequest.status;
          metadata.transactionType = transactionRequest.type;
        } catch (error) {
          assistantText =
            error instanceof Error
              ? `I could not create the transaction draft: ${error.message}`
              : "I could not create the transaction draft.";
          metadata.transactionDraftError = true;
        }
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
        console.error("Failed to save transaction draft assistant message:", error);
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
        } as Record<string, any>;
        updatedUserMsg.content = `[INSTRUCTION: ${commandResult.instruction}]\n\nUser request: ${effectiveUserText}`;

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
  const browserTaskText = resolveBrowserTaskText({
    effectiveUserText,
    isBrowserConnectionContinuation,
    browserConnectionInput: latestMessageBrowserConnectionInfo?.input ?? null,
  });
  const turnIntentText = browserTaskText || effectiveUserText;
  const canHandleForcedBrowserTask =
    isLastMessageUser || isBrowserConnectionContinuation;
  const tradingPairIntent = detectTradingPairIntent(effectiveUserText);
  const shouldForceTradingTool =
    Boolean(tradingPairIntent) &&
    !isVerifiedTraderSignalRequest(effectiveUserText);
  const blenderIntent = isDesktopApp && isBlenderIntent(effectiveUserText);
  const desktopPermissionIntent =
    detectDesktopPermissionIntent(effectiveUserText);
  const shouldForceDesktopPermissionWorkflow =
    Boolean(desktopPermissionIntent);
  const shouldForceBrowserTask =
    browserTaskText && !hasScreenReadIntent && canHandleForcedBrowserTask
      ? shouldForceBrowserTaskFirstStep(browserTaskText)
      : false;
  const shouldForceDesktopScreenshot =
    isDesktopApp && hasScreenReadIntent && !hasImageInput;
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
      console.error("Failed to save missing browser task response:", error);
    }

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const textId = `text-${assistantMessageId}`;
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
  const permissionToolNames =
    isFullAccessMode && toolAccess.allowedToolNames
      ? Array.from(
          new Set([...toolAccess.allowedToolNames, ...FULL_ACCESS_TOOL_NAMES])
        )
      : toolAccess.allowedToolNames;
  const allowedToolNamesForRequest =
    (shouldForceBrowserTask ||
      shouldForceDesktopScreenshot ||
      shouldForceDesktopPermissionWorkflow) &&
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
        console.error("Failed to persist Blender blocked response:", error);
      }
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

  if (desktopPermissionIntent && resolvedChatId) {
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
        "Microphone permission fixes require the Rearvy desktop app. Open this chat in Rearvy Desktop, select Full Access, then ask me to fix the microphone again.";
      metadata.desktopPermissionBlocked = "desktop_app_required";
    } else if (!isFullAccessMode) {
      assistantText =
        "I can prepare a microphone permission workflow, but this chat is in Default Permission. Select Full Access in the chat permission dropdown, then send the request again.";
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
      console.error("Failed to save desktop permission assistant message:", error);
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
        if (toolInput) {
          writer.write({
            type: "tool-input-available",
            toolCallId,
            toolName,
            input: toolInput,
            dynamic: true,
          });
          writer.write({
            type: "tool-output-available",
            toolCallId,
            output: toolOutput,
            dynamic: true,
          });
        }
        const textId = `text-${assistantMessageId}`;
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
      console.error("Failed to save deterministic capability response:", error);
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
    const getTradingOpinionExecute = tools.getTradingOpinion.execute;
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
      console.error("Failed to save manual trading assistant message:", error);
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
          toolName: "getTradingOpinion",
          input: tradingToolInput,
          dynamic: true,
        });
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: tradingToolOutput,
          dynamic: true,
        });

        if (assistantText) {
          const textId = `text-${assistantMessageId}`;
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: assistantText });
          writer.write({ type: "text-end", id: textId });
        }

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

  if (hasScreenReadIntent && !hasImageInput && resolvedChatId) {
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
      console.error("Failed to save manual screenshot assistant message:", error);
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
          toolName,
          input: toolInput,
          dynamic: true,
        });
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: toolOutput,
          dynamic: true,
        });
        const textId = `text-${assistantMessageId}`;
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
        console.error("Failed to save browser connection stop message:", error);
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

        const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
        const chatSnap = await chatRef.get();
        const existingChat = chatSnap.data() as StoredChat | undefined;
        const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

        if (!existingChat?.title) {
          const trimmed = (browserTaskText || effectiveUserText || userMessageSummary).trim();
          if (trimmed) {
            chatUpdates.title =
              trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
          }
        }

        await chatRef.update(chatUpdates);
      } catch (error) {
        console.error("Failed to save browser connection assistant message:", error);
      }

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({
            type: "start",
            messageId: assistantMessageId,
            messageMetadata: { chatId: resolvedChatId },
          });
          writer.write({ type: "start-step" });
          writer.write({
            type: "tool-input-available",
            toolCallId,
            toolName: "requestBrowserConnection",
            input: requestInput,
            dynamic: true,
          });
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
          console.error("Failed to release browser task dedupe marker:", error);
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
        : "";
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

      const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(resolvedChatId);
      const chatSnap = await chatRef.get();
      const existingChat = chatSnap.data() as StoredChat | undefined;
      const chatUpdates: Record<string, unknown> = { updated_at: nowIso };

      if (!existingChat?.title) {
        const trimmed = (browserTaskText || effectiveUserText || userMessageSummary).trim();
        if (trimmed) {
          chatUpdates.title =
            trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
        }
      }

      await chatRef.update(chatUpdates);
    } catch (error) {
      console.error("Failed to save manual browser assistant message:", error);
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
          toolName,
          input: toolInput,
          dynamic: true,
        });
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: toolOutput,
          dynamic: true,
        });
        if (assistantText) {
          const textId = `text-${assistantMessageId}`;
          writer.write({ type: "text-start", id: textId });
          writer.write({ type: "text-delta", id: textId, delta: assistantText });
          writer.write({ type: "text-end", id: textId });
        }
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
      console.error("Failed to save Gmail recipient follow-up:", error);
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
    const prepareGmailMessageExecute = tools.prepareGmailMessage.execute;
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
      console.error("Failed to save Gmail compose assistant message:", error);
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
          toolName: "prepareGmailMessage",
          input: gmailComposeIntent.input,
          dynamic: true,
        });
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: gmailToolOutput,
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

  const routedModel = await resolveModelForChat({
    requestedProviderModel:
      selectedProviderModel === "auto" ? null : selectedProviderModel,
    task: aiProviderTask,
    hasImageInput,
    isDesktopApp,
  });
  const selectedModel = routedModel.model;
  const modelRoute = routedModel.decision;
  const publicModelRoute = sanitizeModelRouteForClient(modelRoute);
  const resolvedProviderModel = modelRoute.providerModel ?? selectedProviderModel;

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
        console.error("Failed to persist no-model fallback response:", error);
      }
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
        const textId = `text-${assistantMessageId}`;
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
    ? "Chat permission mode: Full Access. The user selected high-risk desktop access for this chat. You may use enabled desktop, browser, and terminal tools when appropriate, but you must still obey all approval gates, safety blocks, and user instructions. For device permission issues such as microphone, camera, audio capture, browser permission popups, or visible OS settings, use desktop workflow tools when enabled instead of saying you cannot access the computer. Do not claim desktop work is complete before the Desktop Workspace approval flow runs."
    : "Chat permission mode: Default Permission. Prefer sandboxed, read-only, scoped-folder, or approval-gated actions. Do not assume unrestricted access to the user's computer.";
  const systemPromptWithPermissions = `${baseSystemPrompt}\n\n${permissionContext}`;
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
      maxOutputTokens: 8192,
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
        const response = (event as any).response;
        
        if (response && Array.isArray(response.messages)) {
          assistantMessages = response.messages.filter(
            (message: AssistantMessageRecord) => message.role === "assistant"
          );
        } else if ((event as any).messages && Array.isArray((event as any).messages)) {
          assistantMessages = (event as any).messages.filter(
            (message: AssistantMessageRecord) => message.role === "assistant"
          );
        }

        if (assistantMessages.length === 0) {
          // Construct manually from event if no assistant messages found
          const parts: Array<Record<string, unknown>> = [];
          if (event.text) {
            parts.push({ type: "text", text: event.text });
          }
          if (Array.isArray(event.toolCalls)) {
            for (const tc of event.toolCalls) {
              const fallbackToolCallId =
                typeof tc?.toolCallId === "string" && tc.toolCallId.trim()
                  ? tc.toolCallId
                  : `fallback-tool-${crypto.randomUUID()}`;
              parts.push({
                type: "tool-call",
                toolCallId: fallbackToolCallId,
                toolName: tc?.toolName,
                args: tc && "args" in tc ? tc.args : {},
              });
            }
          }
          if (parts.length > 0) {
            assistantMessages.push({
              id: (event as any).message?.id,
              role: "assistant",
              content: parts,
            });
          }
        }

        for (const msg of assistantMessages) {
          const content = extractAssistantMessageText(msg.content);

          const toolInvocations = Array.isArray(msg.content)
            ? msg.content
              .filter((p: any) => p.type === "tool-call")
              .map((p: any) => ({
                toolName: "toolName" in p ? p.toolName : "",
                args: "args" in p ? p.args : {},
              }))
            : [];

          const toolErrors = Array.isArray(msg.content)
            ? msg.content
              .map((part: any) => part as ToolResultPart)
              .filter((part: any) => part.type === "tool-result")
              .map((part: any) => {
                const payload =
                  part.result !== undefined ? part.result : part.output;
                if (!payload || typeof payload !== "object") return null;

                const asRecord = payload as Record<string, unknown>;
                if (asRecord.ok !== false) return null;

                return {
                  toolName: part.toolName || "unknown",
                  errorCode:
                    typeof asRecord.errorCode === "string"
                      ? asRecord.errorCode
                      : "TOOL_ERROR",
                  message:
                    typeof asRecord.message === "string"
                      ? asRecord.message
                      : "Tool returned an error.",
                };
              })
              .filter((item: any): item is NonNullable<typeof item> => Boolean(item))
            : [];

          if (toolErrors.length > 0) {
            console.warn("Tool errors detected in assistant response:", toolErrors);
          }

          try {
            const storedParts = normalizeStoredParts(msg.content);
            const hasTextContent = Boolean(content && content.trim().length > 0);
            const hasStoredParts = Boolean(storedParts && storedParts.length > 0);
            if (!hasTextContent && !hasStoredParts) {
              console.warn("Skipped persisting empty assistant message", {
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
            console.error("Failed to save assistant message:", error);
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
            const proactiveAlertId = crypto.randomUUID();
            const messageId = assistantMessages[assistantMessages.length - 1]?.id ?? null;

            await adminDb.collection(COLLECTIONS.ASSISTANT_ALERTS).doc(proactiveAlertId).set({
              user_id: user.uid,
              chat_id: resolvedChatId,
              project_id: resolvedProjectId ?? null,
              message_id: messageId,
              title: alert.title,
              summary: alert.summary,
              message_text: alert.messageText,
              severity: alert.severity,
              source: alert.source,
              is_read: false,
              read_at: null,
              created_at: nowIso,
              updated_at: nowIso,
            });
          } catch (error) {
            console.error("Failed to persist proactive assistant alert:", error);
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
          console.error("Failed to update chat title:", error);
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
    console.error("Chat AI error:", error);
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
    console.error("Chat request error:", error);

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
