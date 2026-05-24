import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  convertToModelMessages,
} from "ai";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

import {
  buildSystemPrompt,
  loadSystemPromptContext,
} from "@/lib/ai/system-prompt";
import { buildFreeTierWebResearchContext } from "@/lib/ai/free-tier-web-research";
import { getChatAgentById } from "@/lib/ai/chat-agents";
import { createToolRegistry } from "@/lib/ai/tools";
import {
  resolveChatModelOption,
  resolveChatModelTier,
  resolveChatProviderModel,
} from "@/lib/ai/models";
import {
  buildNoModelConfiguredMessage,
  resolveModelForChat,
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
import { maybeAutoSaveImportantMemory } from "./_helpers/auto-memory";
import {
  buildTradingOpinionSummary,
  isBlenderIntent,
  isVerifiedTraderSignalRequest,
} from "./_helpers/intents";
import { buildMemoryToolTrace } from "./_helpers/memory-trace";
import {
  ensureModelMessageImageTokenAlignment,
  extractAssistantMessageText,
  extractFallbackUserText,
  findLatestUserMessage,
  normalizeStoredParts,
  pruneAssistantPlaceholders,
  repairAssistantMessagesForModelReplay,
  sanitizeIncomingMessages,
  sanitizeOutboundModelMessages,
  trimTrailingAssistantPlaceholders,
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
  const messages = trimTrailingAssistantPlaceholders(
    pruneAssistantPlaceholders(
      repairAssistantMessagesForModelReplay(
        sanitizeIncomingMessages(rawMessages)
      )
    )
  );
  const messagesForModel = normalizeIncomingMessagesForModel(messages);
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

  if (typeof rawAgentId === "string" && rawAgentId.trim() && !getChatAgentById(rawAgentId.trim())) {
    return new Response(
      JSON.stringify({ error: "Invalid agentId." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

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
  if (!aiModel) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid aiModel. Please retry with a supported model without auto-switching.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const lastMessage =
    messages.length > 0
      ? (messages[messages.length - 1] as IncomingMessage)
      : null;
  const isLastMessageUser = lastMessage?.role === "user";
  const userMessageSummary = lastMessage
    ? buildUserMessageSummary(lastMessage)
    : "";
  const latestUserMessage = findLatestUserMessage(messages);
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

  const effectiveUserText =
    effectiveUserMessage ? extractIncomingMessageText(effectiveUserMessage) : "";
  const effectiveUserMessageSummary = effectiveUserMessage
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

  if (effectiveUserText) {
    void maybeAutoSaveImportantMemory({
      adminDb,
      userId: user.uid,
      userText: effectiveUserText,
      projectId: resolvedProjectId,
    });
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
      const transactionAgent = getChatAgentById(resolvedAgentId);
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
  const resolvedAgent = getChatAgentById(resolvedAgentId);
  // All users now have access to web tools - no tier restrictions
  const includeWebTools = true;
  const freeTierWebResearch = await buildFreeTierWebResearchContext({
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
  const baseSystemPrompt = buildSystemPrompt({
    context: promptContext,
    agent: resolvedAgent,
    webResearchMode: includeWebTools ? "tools" : "none",
    responseMode: "deep",
    isDesktopApp,
  });
  const systemPrompt = mempalaceRecallContext
    ? `${baseSystemPrompt}\n\n${mempalaceRecallContext}`
    : baseSystemPrompt;

  const hasImageInput = messages.some((message) => messageHasImageParts(message));
  const modelOption = resolveChatModelOption(aiModel);
  const selectedProviderModel = resolveChatProviderModel(aiModel, {
    hasImageInput,
  });
  const tradingPairIntent = detectTradingPairIntent(effectiveUserText);
  const shouldForceTradingTool =
    Boolean(tradingPairIntent) &&
    !isVerifiedTraderSignalRequest(effectiveUserText);
  const blenderIntent = isDesktopApp && isBlenderIntent(effectiveUserText);
  const tools = !effectiveUserText
    ? null
    : await createToolRegistry(
        {
          userId: user.uid,
          adminDb,
          chatId: resolvedChatId,
          projectId: resolvedProjectId,
          chatProviderModel: selectedProviderModel,
          isDesktopApp,
        },
        {
          includeWebTools,
          // When running in the desktop app, prefer MCP tools and disable
          // browser automation tools which don't work in serverless environments.
          includeBrowserTools: !isDesktopApp,
          // For Blender-intent requests, disable terminal tools so the model
          // doesn't execute bpy snippets as shell commands.
          includeTerminalTools: !blenderIntent,
        }
      );

  const blenderToolNames = tools
    ? Object.keys(tools).filter((name) => /^mcp_/i.test(name) && /blender/i.test(name))
    : [];

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
    requestedProviderModel: selectedProviderModel,
    hasImageInput,
    isDesktopApp,
  });
  const selectedModel = routedModel.model;
  const modelRoute = routedModel.decision;
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
            modelRoute,
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

  // NVIDIA-compatible chat streaming currently fails on streamed tool-call chunks
  // for some providers, so keep the main chat turn text-only and use explicit
  // pre-call tool execution paths where we need deterministic tool usage.
  // Exception: Desktop apps with MCP tools (Blender, etc.) need streaming tool support
  const isToolCapableModel = isDesktopApp && tools && Object.keys(tools).length > 0;

  try {
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
                  : undefined,
          }
        : {}),
      onFinish: async (event) => {
        if (!resolvedChatId) return;
        const nowIso = new Date().toISOString();

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
                modelRoute,
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
        if (part.type === "start" || part.type === "finish") {
          return {
            chatId: resolvedChatId,
            modelRoute,
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
