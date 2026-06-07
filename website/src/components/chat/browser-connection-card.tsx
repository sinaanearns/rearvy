"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Globe,
  Loader2,
  PlugZap,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getBrowserConnectionOutputStatus,
  resolveBrowserConnectionMethod,
  type BrowserConnectionCardDisplay,
  type BrowserConnectionMethod,
} from "@/lib/chat/browser-connection-rendering";
import { createLocalRelayBrowserBridge } from "@/lib/browser-use/local-relay-client";
import { cn } from "@/lib/utils";

type ToolOutputHandler = (params: {
  tool: string;
  toolCallId: string;
  output: unknown;
}) => void | PromiseLike<void>;

type BrowserConnectionCardProps = {
  toolCallId?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  browserCardMode?: "full" | "details";
  display?: BrowserConnectionCardDisplay;
  onToolOutput?: ToolOutputHandler;
};

type BrowserBridge = {
  getConnectionStatus?: () => Promise<BrowserConnectionStatus>;
  openBrowserInternalUrl?: (url: string) => Promise<unknown>;
  openChromeInternalUrl?: (url: string) => Promise<unknown>;
  openExtensionOptions?: (options?: { pairingCode?: string; relayUrl?: string }) => Promise<unknown>;
  createRelayPairingCode?: () => Promise<{ ok?: boolean; pairingCode?: string; port?: number; error?: string }>;
  getRelayInfo?: () => Promise<BrowserRelayInfo>;
};

type BrowserRelayInfo = {
  ok?: boolean;
  port?: number;
  extensionPath?: string;
  extensionId?: string | null;
  extensionOptionsUrl?: string | null;
  relaySetupUrl?: string | null;
  pairingCode?: string | null;
};

type BrowserConnectionStatus = {
  cdpDirect?: {
    connected?: boolean;
    browser?: string;
    version?: string;
    webSocketDebuggerUrl?: string;
    error?: string;
  };
  extensionRelay?: {
    connected?: boolean;
    active?: boolean;
    trusted?: boolean;
    stale?: boolean;
    extensionId?: string | null;
    version?: string | null;
    tabCount?: number;
    lastSeenAt?: string | null;
    pairingCode?: string | null;
    error?: string;
  };
  recommendedMethod?: BrowserConnectionMethod;
};

const METHOD_LABELS: Record<BrowserConnectionMethod, string> = {
  "cdp-direct": "CDP Direct",
  "extension-relay": "Browser Extension",
  "managed-runner": "Managed Runner",
};

const submittedConnectionToolCalls = new Set<string>();

function submittedToolCallStorageKey(toolCallId: string) {
  return `rearvy:browser-connection-submitted:${toolCallId}`;
}

function hasSubmittedConnectionToolCall(toolCallId: string) {
  if (submittedConnectionToolCalls.has(toolCallId)) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(submittedToolCallStorageKey(toolCallId)) === "1";
  } catch {
    return false;
  }
}

function markSubmittedConnectionToolCall(toolCallId: string) {
  submittedConnectionToolCalls.add(toolCallId);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(submittedToolCallStorageKey(toolCallId), "1");
  } catch {
    // The in-memory guard still covers the current render lifetime.
  }
}

function clearSubmittedConnectionToolCall(toolCallId: string) {
  submittedConnectionToolCalls.delete(toolCallId);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(submittedToolCallStorageKey(toolCallId));
  } catch {
    // Ignore storage cleanup failures.
  }
}

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

function normalizeMethods(value: unknown): BrowserConnectionMethod[] {
  const methods = Array.isArray(value) ? value : ["cdp-direct", "extension-relay"];
  const allowed = new Set(["cdp-direct", "extension-relay", "managed-runner"]);
  return methods
    .filter((method): method is BrowserConnectionMethod =>
      typeof method === "string" && allowed.has(method)
    )
    .slice(0, 3);
}

function getInput(input: unknown): {
  task: string;
  reason: string;
  preferredMethod: BrowserConnectionMethod;
  allowedMethods: BrowserConnectionMethod[];
  requireFunctionalControl: boolean;
} {
  const record = asRecord(input) ?? {};
  return {
    task: firstString(record.task, record.requestedAction),
    reason:
      firstString(record.reason) ||
      "Rearvy needs a connected browser before it can continue this browser task.",
    preferredMethod:
      firstString(record.preferredMethod) === "cdp-direct"
        ? "cdp-direct"
        : "extension-relay",
    allowedMethods: normalizeMethods(record.allowedMethods),
    requireFunctionalControl: record.requireFunctionalControl !== false,
  };
}

function getBrowserBridge(): BrowserBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const electronBridge = (
    window as Window & {
      electron?: { browser?: BrowserBridge };
    }
  ).electron?.browser;

  return electronBridge ?? createLocalRelayBrowserBridge();
}

function methodConnected(status: BrowserConnectionStatus | null, method: BrowserConnectionMethod) {
  if (method === "cdp-direct") {
    return Boolean(status?.cdpDirect?.connected);
  }

  if (method === "extension-relay") {
    return Boolean(status?.extensionRelay?.connected);
  }

  return true;
}

function connectionSummary(status: BrowserConnectionStatus | null, method: BrowserConnectionMethod) {
  if (method === "cdp-direct") {
    if (status?.cdpDirect?.connected) {
      return status.cdpDirect.browser || "Browser remote debugging is available.";
    }

    return status?.cdpDirect?.error || "Browser DevTools Protocol is not connected.";
  }

  if (method === "extension-relay") {
    if (status?.extensionRelay?.connected) {
      if (status.extensionRelay.stale || status.extensionRelay.trusted) {
        return "Saved Rearvy extension is available. Rearvy will reconnect to it automatically when a browser task starts.";
      }

      const tabCount = status.extensionRelay.tabCount;
      return typeof tabCount === "number"
        ? `Extension relay connected with ${tabCount} tab${tabCount === 1 ? "" : "s"}.`
        : "Extension relay connected.";
    }

    return status?.extensionRelay?.error || "Browser extension relay is not connected.";
  }

  return "Rearvy can use the managed local browser runner.";
}

function getCompletedConnectionStatus(
  output: unknown,
  outputStatus: ReturnType<typeof getBrowserConnectionOutputStatus>,
  method: BrowserConnectionMethod
): BrowserConnectionStatus | null {
  if (outputStatus !== "connected") {
    return null;
  }

  const record = asRecord(output) ?? {};
  const connectedBrowser = asRecord(record.connectedBrowser) ?? {};
  const metadata = asRecord(record.connectionMetadata) ?? {};

  if (method === "extension-relay") {
    return {
      extensionRelay: {
        connected: true,
        extensionId:
          typeof metadata.extensionId === "string" ? metadata.extensionId : null,
        tabCount:
          typeof metadata.tabCount === "number" ? metadata.tabCount : undefined,
      },
    };
  }

  if (method === "cdp-direct") {
    return {
      cdpDirect: {
        connected: true,
        browser: firstString(connectedBrowser.name),
        webSocketDebuggerUrl: firstString(connectedBrowser.webSocketDebuggerUrl),
      },
    };
  }

  return {};
}

function compactTitle(outputStatus: ReturnType<typeof getBrowserConnectionOutputStatus>) {
  if (outputStatus === "connected") {
    return "Browser connected";
  }

  if (outputStatus === "skipped") {
    return "Browser connection skipped";
  }

  return "Browser connection failed";
}

function compactSummary(
  output: unknown,
  outputStatus: ReturnType<typeof getBrowserConnectionOutputStatus>,
  method: BrowserConnectionMethod,
  status: BrowserConnectionStatus | null
) {
  const record = asRecord(output) ?? {};
  const message = firstString(record.message);
  if (message) {
    return message;
  }

  if (outputStatus === "connected") {
    return `${METHOD_LABELS[method]} is ready.`;
  }

  if (outputStatus === "skipped") {
    return "Rearvy did not continue the browser task.";
  }

  return connectionSummary(status, method);
}

export function BrowserConnectionCard({
  toolCallId,
  state,
  input,
  output,
  browserCardMode = "full",
  display,
  onToolOutput,
}: BrowserConnectionCardProps) {
  const cardInput = useMemo(() => getInput(input), [input]);
  const outputStatus = getBrowserConnectionOutputStatus(output);
  const resolvedMethod = useMemo(
    () => resolveBrowserConnectionMethod(input, output),
    [input, output]
  );
  const completedStatus = useMemo(
    () => getCompletedConnectionStatus(output, outputStatus, resolvedMethod),
    [output, outputStatus, resolvedMethod]
  );
  const isComplete = outputStatus !== null;
  const method: BrowserConnectionMethod = isComplete ? resolvedMethod : "extension-relay";
  const [status, setStatus] = useState<BrowserConnectionStatus | null>(null);
  const [relayInfo, setRelayInfo] = useState<BrowserRelayInfo | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const autoContinueSubmittedRef = useRef(false);
  const autoPairStartedRef = useRef(false);
  const effectiveStatus = isComplete ? completedStatus : status;
  const canRespond =
    !isComplete &&
    Boolean(toolCallId) &&
    typeof onToolOutput === "function" &&
    (state === "input-available" || state === "input-streaming");

  const refreshStatus = useCallback(async () => {
    const bridge = getBrowserBridge();
    if (!bridge?.getConnectionStatus) {
      setStatus({
        cdpDirect: {
          connected: false,
          error: "Open Rearvy Desktop to connect a local browser.",
        },
        extensionRelay: {
          connected: false,
          error: "Open Rearvy Desktop to use the browser relay.",
        },
      });
      return;
    }

    try {
      const nextStatus = await bridge.getConnectionStatus();
      setStatus(nextStatus);
      if (bridge.getRelayInfo) {
        const nextRelayInfo = await bridge.getRelayInfo();
        setRelayInfo(nextRelayInfo);
        setPairingCode(nextRelayInfo.pairingCode || null);
      }
    } catch (error) {
      setStatus({
        cdpDirect: {
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        },
        extensionRelay: {
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }, []);

  useEffect(() => {
    if (isComplete) {
      return;
    }

    void refreshStatus();
    const interval = setInterval(() => void refreshStatus(), 2000);
    return () => clearInterval(interval);
  }, [isComplete, refreshStatus]);

  useEffect(() => {
    autoContinueSubmittedRef.current = false;
    autoPairStartedRef.current = false;
  }, [toolCallId]);

  const runBridgeAction = useCallback(async (
    action: string,
    handler: (bridge: BrowserBridge) => Promise<unknown>
  ) => {
    const bridge = getBrowserBridge();
    if (!bridge) {
      toast.error("Rearvy Desktop browser bridge is unavailable.");
      return;
    }

    setActiveAction(action);
    try {
      const result = await handler(bridge);
      const record = asRecord(result);
      if (record?.ok === false || record?.success === false) {
        throw new Error(firstString(record.error, record.reason) || "Browser action failed.");
      }
      if (action === "pair-extension" && record?.fallback) {
        toast.success("Rearvy Browser Relay setup opened in your browser.");
      }
      await refreshStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveAction(null);
    }
  }, [refreshStatus]);

  const connectRearvy = useCallback(async () => {
    await runBridgeAction("pair-extension", async (bridge) => {
      let nextPairingCode = pairingCode || undefined;
      let nextRelayPort = relayInfo?.port;

      if (bridge.createRelayPairingCode) {
        const created = await bridge.createRelayPairingCode();
        if (created.pairingCode) {
          nextPairingCode = created.pairingCode;
          setPairingCode(created.pairingCode);
        }
        if (typeof created.port === "number") {
          nextRelayPort = created.port;
        }
      }

      const nextRelayUrl = nextRelayPort
        ? `http://127.0.0.1:${nextRelayPort}`
        : undefined;

      if (bridge.openExtensionOptions) {
        return bridge.openExtensionOptions({
          pairingCode: nextPairingCode,
          relayUrl: nextRelayUrl,
        });
      }
      const openInternalUrl =
        bridge.openBrowserInternalUrl ?? bridge.openChromeInternalUrl;
      if (!openInternalUrl) {
        throw new Error("Opening browser setup pages is unavailable.");
      }
      return openInternalUrl("chrome://extensions");
    });
  }, [pairingCode, relayInfo?.port, runBridgeAction]);

  const submit = useCallback(async (nextStatus: "connected" | "skipped" | "failed") => {
    if (!toolCallId || !onToolOutput || isSubmitting) {
      return;
    }

    if (hasSubmittedConnectionToolCall(toolCallId)) {
      return;
    }

    if (nextStatus === "connected" && !methodConnected(status, method)) {
      toast.error(connectionSummary(status, method));
      return;
    }

    markSubmittedConnectionToolCall(toolCallId);
    setIsSubmitting(true);
    try {
      await onToolOutput({
        tool: "requestBrowserConnection",
        toolCallId,
        output: {
          status: nextStatus,
          method: nextStatus === "connected" ? method : undefined,
          message:
            nextStatus === "connected"
              ? connectionSummary(status, method)
              : "Browser connection was skipped.",
          connectedBrowser:
            method === "cdp-direct" && status?.cdpDirect?.connected
              ? {
                  name: status.cdpDirect.browser,
                  webSocketDebuggerUrl: status.cdpDirect.webSocketDebuggerUrl,
                }
              : undefined,
          connectionMetadata: {
            relayPort: relayInfo?.port,
            extensionId: status?.extensionRelay?.extensionId,
            tabCount: status?.extensionRelay?.tabCount,
          },
          respondedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      clearSubmittedConnectionToolCall(toolCallId);
      toast.error(error instanceof Error ? error.message : "Could not continue.");
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, method, onToolOutput, relayInfo, status, toolCallId]);

  useEffect(() => {
    if (
      !canRespond ||
      isSubmitting ||
      activeAction !== null ||
      autoContinueSubmittedRef.current ||
      !methodConnected(status, method)
    ) {
      return;
    }

    autoContinueSubmittedRef.current = true;
    void submit("connected");
  }, [activeAction, canRespond, isSubmitting, method, status, submit]);

  useEffect(() => {
    if (
      !canRespond ||
      isComplete ||
      isSubmitting ||
      activeAction !== null ||
      autoPairStartedRef.current ||
      status === null ||
      methodConnected(status, method)
    ) {
      return;
    }

    const relayError = status.extensionRelay?.error || "";
    if (/open rearvy desktop|requires rearvy desktop|start rearvy desktop/i.test(relayError)) {
      return;
    }

    autoPairStartedRef.current = true;
    void connectRearvy();
  }, [activeAction, canRespond, connectRearvy, isComplete, isSubmitting, method, status]);

  if (display === "hidden") {
    return null;
  }

  if (display === "compact" || isComplete) {
    const isConnected = outputStatus === "connected";
    const isSkipped = outputStatus === "skipped";

    return (
      <div
        className={cn(
          "w-full rounded-[8px] border bg-card/70 p-3 shadow-sm shadow-slate-950/[0.03]",
          browserCardMode === "details" ? "max-w-lg" : "max-w-md",
          isConnected
            ? "border-emerald-500/25"
            : isSkipped
              ? "border-amber-500/25"
              : "border-rose-500/25"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
              isConnected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : isSkipped
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
            )}
          >
            {isConnected ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              {compactTitle(outputStatus)}
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {METHOD_LABELS[method]}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {compactSummary(output, outputStatus, method, effectiveStatus)}
            </p>
            {browserCardMode === "full" && cardInput.task ? (
              <p className="mt-1 truncate text-xs text-muted-foreground/80">
                Task: {cardInput.task}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-[8px] border border-emerald-500/40 bg-background p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {outputStatus === "connected"
                  ? "Browser connected"
                  : outputStatus === "skipped"
                    ? "Browser connection skipped"
                    : "Preparing browser relay"}
              </div>
              <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-300">
                {methodConnected(effectiveStatus, method)
                  ? "Connected"
                  : activeAction
                    ? "Setting up"
                    : "Automatic setup"}
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {cardInput.reason}
          </p>
          {cardInput.task ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Task: {cardInput.task}
            </p>
          ) : null}

          <div className="mt-4 flex items-start gap-3 rounded-[8px] border border-border bg-muted/30 p-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              {methodConnected(effectiveStatus, method) ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                {methodConnected(effectiveStatus, method)
                  ? "Rearvy extension available"
                  : "Setting up Rearvy extension"}
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {methodConnected(effectiveStatus, method)
                  ? connectionSummary(effectiveStatus, method)
                  : "Rearvy will use the saved extension automatically. No extension click is needed unless the extension was removed."}
              </p>
              {!methodConnected(effectiveStatus, method) ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground/80">
                  {connectionSummary(effectiveStatus, method)}
                </p>
              ) : null}
            </div>
          </div>

          {canRespond ? (
            <div className="mt-4">
              <Button
                type="button"
                onClick={() => void connectRearvy()}
                disabled={
                  activeAction !== null ||
                  isSubmitting ||
                  methodConnected(status, method)
                }
                className="rounded-[8px] bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {activeAction || isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}
                {methodConnected(status, method)
                  ? "Connected"
                  : activeAction
                    ? "Connecting..."
                    : "Set up now"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
