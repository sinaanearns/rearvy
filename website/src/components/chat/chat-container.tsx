"use client";

import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback, type WheelEvent } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { ChatTemplates } from "./chat-templates";
import { BrowserWorkspacePane } from "./browser-workspace-pane";
import DesktopWorkspacePane from "./desktop-workspace-pane";
import {
  readBrowserWorkspacePreference,
  writeBrowserWorkspacePreference,
  BROWSER_WORKSPACE_PREFERENCE_KEY,
} from "@/lib/chat/browser-preferences";


import { DEFAULT_PLAN, type SubscriptionPlan } from "@/lib/plans";
import { AlertCircle, Download, Monitor } from "lucide-react";
import { toast } from "sonner";
import {
  getAvailableChatModels,
  type ChatModelTier,
} from "@/lib/ai/models";
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

import { isWebDeployment } from "@/lib/utils/env";
import { isScreenReadIntent } from "@/lib/screen-intent";
import {
  CHAT_PERMISSION_MODE_STORAGE_KEY,
  DEFAULT_DESKTOP_WORKSPACE_SCOPE,
  normalizeChatPermissionMode,
  normalizeDesktopWorkspaceScope,
  type ChatPermissionMode,
  type DesktopWorkspaceScope,
} from "@/lib/chat/permissions";

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
  initialAgentId?: string | null;
}

type ChatMessage = PersistentChatMessage;
type PendingOutgoingMessage = {
  text: string;
  files: File[];
  screenCaptureAttempted?: boolean;
};

const AUTO_SCROLL_THRESHOLD_PX = 24;
const CUSTOM_CHAT_MODELS_STORAGE_KEY = "rearvy.custom-chat-models.v1";
const ACTIVE_DESKTOP_WORKFLOW_STATES = new Set([
  "pending-approval",
  "running",
  "paused",
]);

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

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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

function isDesktopWorkflow(value: unknown): value is DesktopWorkflow {
  const workflow = asRecord(value);
  if (!workflow) {
    return false;
  }

  return (
    typeof workflow.id === "string" &&
    typeof workflow.name === "string" &&
    typeof workflow.source === "string" &&
    workflow.requiresApproval === true &&
    Array.isArray(workflow.steps)
  );
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

  return isDesktopWorkflow(output.workflow) ? output.workflow : null;
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
      if (!part || typeof part !== "object") {
        continue;
      }

      const record = part as Record<string, unknown>;
      if (record.toolName !== "saveMemory") {
        continue;
      }

      const output =
        record.output && typeof record.output === "object"
          ? (record.output as Record<string, unknown>)
          : null;

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

function getLatestResolvedChatId(messages: ChatMessage[]): string | null {
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
  return files.some((file) => file.type.startsWith("image/"));
}

function dataUrlToFile(dataUrl: string | null | undefined, fileName: string) {
  if (!dataUrl) {
    return null;
  }

  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
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
    console.error("Failed to capture screen for chat:", error);
    toast.error("Could not capture the screen. Trying the Desktop Workspace fallback.");
    return { ...message, screenCaptureAttempted: true };
  }
}

export function ChatContainer({
  chatId,
  projectId,
  initialAgentId = null,
  initialMessages = [],
  aiModel = "auto",
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
  const [token, setToken] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan>(DEFAULT_PLAN);
  const [selectedModel, setSelectedModel] = useState<ChatModelTier>(aiModel || "auto");
  const [permissionMode, setPermissionMode] =
    useState<ChatPermissionMode>("default");
  const [desktopScope, setDesktopScope] =
    useState<DesktopWorkspaceScope>(DEFAULT_DESKTOP_WORKSPACE_SCOPE);
  const [isDesktopWorkspaceAvailable, setIsDesktopWorkspaceAvailable] =
    useState(false);
  const [desktopPlatform, setDesktopPlatform] = useState<string | null>(null);
  const [customModels, setCustomModels] = useState<
    ReturnType<typeof getAvailableChatModels>
  >([]);
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
  const activeDesktopWorkflowIdRef = useRef<string | null>(null);
  const [isBrowserPaneOpen, setIsBrowserPaneOpen] = useState(false);
  const [hasActiveDesktopWorkflow, setHasActiveDesktopWorkflow] = useState(false);
  const [isDesktopWorkspaceOpen, setIsDesktopWorkspaceOpen] = useState(false);
  const browserWorkspaceStorageKey = BROWSER_WORKSPACE_PREFERENCE_KEY;
  const manualBrowsingEnabled = true;

  const availableModels = useMemo(
    () => getAvailableChatModels(plan, customModels),
    [customModels, plan]
  );
  const effectiveModel = selectedModel;


  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CUSTOM_CHAT_MODELS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }

      setCustomModels(parsed);
    } catch (error) {
      console.warn("Failed to load custom chat models:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedMode = normalizeChatPermissionMode(
      window.localStorage.getItem(CHAT_PERMISSION_MODE_STORAGE_KEY)
    );
    setPermissionMode(savedMode);

    const workspace = getDesktopWorkspaceBridge();
    const getCapabilities = getDesktopCapabilitiesBridge();
    if (!workspace?.getScope) {
      setIsDesktopWorkspaceAvailable(false);
      setDesktopPlatform(null);
      setPermissionMode("default");
      return;
    }

    let isActive = true;
    setIsDesktopWorkspaceAvailable(true);

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
          setPermissionMode(
            normalizedScope.mode === "full-access" ? "full-access" : "default"
          );
        } else {
          console.warn("Failed to read desktop workspace scope:", scopeResult.reason);
        }

        if (capabilitiesResult.status === "fulfilled") {
          const platform =
            typeof capabilitiesResult.value?.platform === "string" &&
            capabilitiesResult.value.platform.trim()
              ? capabilitiesResult.value.platform.trim().toLowerCase()
              : null;
          setDesktopPlatform(platform);
        } else {
          console.warn("Failed to read desktop capabilities:", capabilitiesResult.reason);
          setDesktopPlatform(null);
        }
      })
      .catch((error) => {
        console.warn("Failed to read desktop workspace context:", error);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const customOnly = availableModels.filter((model) => model.isCustom);
    window.localStorage.setItem(
      CUSTOM_CHAT_MODELS_STORAGE_KEY,
      JSON.stringify(customOnly)
    );
  }, [availableModels]);

  useEffect(() => {
    const hasSelectedModel = availableModels.some((model) => model.id === selectedModel);
    if (!hasSelectedModel && availableModels[0]) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel]);

  useEffect(() => {
    setActiveChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

  useEffect(() => {
    let isActive = true;

    const loadSessionContext = async () => {
      try {
        if (!user) {
          if (!isActive) {
            return;
          }
          setToken(null);
          setPlan(DEFAULT_PLAN);
          return;
        }

        const idToken = await getIdToken();
        if (!isActive) {
          return;
        }

        setToken(idToken);

        const response = await fetch("/api/dashboard/profile", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!response.ok) {
          throw new Error("Failed to load profile");
        }

        await response.json() as {
          profile?: { plan?: SubscriptionPlan | null };
        };

        if (!isActive) {
          return;
        }

        setPlan(DEFAULT_PLAN);
      } catch (error) {
        console.error("Failed to load chat plan context:", error);
        if (isActive) {
          setPlan(DEFAULT_PLAN);
        }
      }
    };

    loadSessionContext();

    return () => {
      isActive = false;
    };
  }, [user]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (user) {
      const freshToken = await getIdToken();
      if (freshToken) {
        return { Authorization: `Bearer ${freshToken}` };
      }
    }

    return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
  }, [token, user]);

  const handlePermissionModeChange = useCallback(
    async (nextMode: ChatPermissionMode) => {
      const normalizedMode = normalizeChatPermissionMode(nextMode);

      if (normalizedMode === "full-access") {
        const workspace = getDesktopWorkspaceBridge();
        if (!workspace?.setScope) {
          toast.error("Full Access is available only in the Rearvy desktop app.");
          return;
        }

        try {
          const nextScope = normalizeDesktopWorkspaceScope(
            await workspace.setScope({
              mode: "full-access",
              path: desktopScope.path,
            })
          );
          setDesktopScope(nextScope);
          setPermissionMode("full-access");
          window.localStorage.setItem(
            CHAT_PERMISSION_MODE_STORAGE_KEY,
            "full-access"
          );
          toast.warning("Full Access enabled for desktop workflows.");
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to enable Full Access."
          );
        }

        return;
      }

      setPermissionMode("default");
      window.localStorage.setItem(CHAT_PERMISSION_MODE_STORAGE_KEY, "default");

      const workspace = getDesktopWorkspaceBridge();
      if (!workspace?.setScope) {
        return;
      }

      try {
        const nextScope = normalizeDesktopWorkspaceScope(
          await workspace.setScope({
            mode: "folder",
            path: desktopScope.path,
          })
        );
        setDesktopScope(nextScope);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to switch to Default Permission."
        );
      }
    },
    [desktopScope.path]
  );

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
        nextScope.mode === "full-access" ? "full-access" : "default";
      setPermissionMode(nextMode);
      window.localStorage.setItem(CHAT_PERMISSION_MODE_STORAGE_KEY, nextMode);
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
        agentId: initialAgentId,
        chatPermissionMode: permissionMode,
        desktopPlatform,
        getHeaders: getAuthHeaders,
        initialMessages: initialMessages as PersistentChatMessage[],
      }),
    [
      chatId,
      effectiveModel,
      getAuthHeaders,
      initialAgentId,
      permissionMode,
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
      agentId: initialAgentId,
      chatPermissionMode: permissionMode,
      desktopPlatform,
      getHeaders: getAuthHeaders,
    });
  }, [
    activeChatId,
    chatId,
    effectiveModel,
    getAuthHeaders,
    initialAgentId,
    permissionMode,
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

  const latestBrowserToolOutput = useMemo(() => {
    const allParts = messages.flatMap((m) => m.parts ?? []);
    const browserParts = allParts.filter((p) => {
      if (!p || typeof (p as any).type !== "string") return false;
      const t = (p as any).type as string;
      if (!t.startsWith("tool-") && t !== "dynamic-tool") return false;
      const name: string = (p as any).toolName || t.replace("tool-", "");
      return name === "runBrowserTask" || name === "controlBrowserSession";
    });
    if (browserParts.length === 0) return null;
    const lastPart = browserParts[browserParts.length - 1] as any;
    const payload = lastPart.output ?? lastPart.result ?? null;
    return payload && typeof payload === "object"
      ? (payload as Record<string, any>)
      : null;
  }, [messages]);

  const activeBrowserSessionId = latestBrowserToolOutput?.browserSessionId as string | undefined;

  const syncDesktopAutomationState = useCallback((nextState: unknown) => {
    const activeWorkflowId = getActiveDesktopWorkflowStateId(nextState);
    setHasActiveDesktopWorkflow(Boolean(activeWorkflowId));

    if (!activeWorkflowId) {
      activeDesktopWorkflowIdRef.current = null;
      return;
    }

    if (activeDesktopWorkflowIdRef.current !== activeWorkflowId) {
      activeDesktopWorkflowIdRef.current = activeWorkflowId;
      setIsDesktopWorkspaceOpen(true);
    }
  }, []);

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
          console.warn("Failed to read desktop automation state:", error);
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
            if (!result.state) {
              syncDesktopAutomationState(null);
            }
            const message = result.error || result.reason || "Desktop workflow could not be started.";
            toast.error(message);
            return;
          }

          toast.success(`${workflow.name} is ready for approval.`);
        })
        .catch((error) => {
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

  const handleToolOutput = useCallback(
    async (params: { tool: string; toolCallId: string; output: unknown }) => {
      await (addToolOutput as unknown as (args: {
        tool: string;
        toolCallId: string;
        output: unknown;
      }) => void | PromiseLike<void>)({
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
        agentId: initialAgentId,
        chatPermissionMode: permissionMode,
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
    desktopPlatform,
    projectId,
    initialAgentId,
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
    console.warn("Detected empty assistant turn; retrying once", {
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
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-3 pb-10 pt-8 sm:px-6 sm:pt-10 lg:px-8 xl:px-10">
            {isWebDeployment() && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-6 py-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sky-100">Rearvy App is available</h3>
                    <p className="text-sm text-sky-200/80">
                      Download the desktop app for the full experience, including high-performance browser automation.
                    </p>
                  </div>
                </div>
                <Button 
                  asChild
                  variant="default" 
                  className="bg-sky-500 hover:bg-sky-600 text-white"
                >
                  <a href="/download">
                    Download App
                  </a>
                </Button>
              </div>
            )}

            {latestBrowserToolOutput && !isBrowserPaneOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Image
                      src="/favicon.png?v=20260523a"
                      alt="Rearvy"
                      width={16}
                      height={16}
                      className="h-4 w-4 rounded object-cover"
                    />
                    <span>App browser activity is available</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    View the browser stream Rearvy used for this app workflow. {manualBrowsingEnabled ? "Manual browsing is enabled." : "Manual browsing is disabled."}
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 shadow-sm">
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
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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

            {/* Loading indicators removed per user request to speed up perception */}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border/70 bg-background/85 px-3 pb-5 pt-4 backdrop-blur-xl sm:px-6">
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            queuedMessageCount={queuedMessages.length}
            onStop={stop}
            permissionMode={permissionMode}
            onPermissionModeChange={handlePermissionModeChange}
            workspaceScope={desktopScope}
            onPickWorkspaceFolder={handlePickWorkspaceFolder}
            isDesktopWorkspaceAvailable={isDesktopWorkspaceAvailable}
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
  );
}

