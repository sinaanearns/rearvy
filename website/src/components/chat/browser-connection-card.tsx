"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  FolderOpen,
  Globe,
  Loader2,
  PlugZap,
  ShieldAlert,
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
  openExtensionFolder?: () => Promise<unknown>;
  copyExtensionPath?: () => Promise<unknown>;
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
      firstString(record.preferredMethod) === "extension-relay"
        ? "extension-relay"
        : "cdp-direct",
    allowedMethods: normalizeMethods(record.allowedMethods),
    requireFunctionalControl: record.requireFunctionalControl !== false,
  };
}

function getBrowserBridge(): BrowserBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window as Window & {
      electron?: { browser?: BrowserBridge };
    }
  ).electron?.browser ?? null;
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
  const [method, setMethod] = useState<BrowserConnectionMethod>(
    resolvedMethod
  );
  const [status, setStatus] = useState<BrowserConnectionStatus | null>(null);
  const [relayInfo, setRelayInfo] = useState<BrowserRelayInfo | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const autoContinueSubmittedRef = useRef(false);
  const isComplete = outputStatus !== null;
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

    setIsRefreshing(true);
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
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setMethod(resolvedMethod);
  }, [resolvedMethod, toolCallId]);

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
  }, [toolCallId]);

  const runBridgeAction = async (
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
  };

  const sendRequest = async () => {
    if (method === "cdp-direct") {
      await runBridgeAction("open-cdp", (bridge) => {
        const openInternalUrl =
          bridge.openBrowserInternalUrl ?? bridge.openChromeInternalUrl;
        if (!openInternalUrl) {
          throw new Error("Opening browser setup pages is unavailable.");
        }
        return openInternalUrl("chrome://inspect/#remote-debugging");
      });
      return;
    }

    if (method === "extension-relay") {
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
    }
  };

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

  if (display === "hidden") {
    return null;
  }

  if (display === "compact" || isComplete) {
    const isConnected = outputStatus === "connected";
    const isSkipped = outputStatus === "skipped";

    return (
      <div
        className={cn(
          "w-full rounded-xl border bg-card/70 p-3 shadow-sm",
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
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
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
    <div className="w-full max-w-2xl rounded-xl border border-emerald-500/40 bg-background p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">
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
                    : "Browser Connection Required"}
              </div>
              <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-300">
                {methodConnected(effectiveStatus, method) ? "Connected" : "Browser not connected"}
              </p>
            </div>
            {canRespond ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void submit("skipped")}
                disabled={isSubmitting}
                title="Skip"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {cardInput.reason}
          </p>
          {cardInput.task ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Task: {cardInput.task}
            </p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {cardInput.allowedMethods.map((allowedMethod) => {
              const selected = allowedMethod === method;
              const connected = methodConnected(effectiveStatus, allowedMethod);
              return (
                <button
                  key={allowedMethod}
                  type="button"
                  onClick={() => setMethod(allowedMethod)}
                  disabled={!canRespond}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition",
                    selected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {allowedMethod === "cdp-direct" ? (
                      <Code2 className="h-4 w-4 text-indigo-500" />
                    ) : (
                      <PlugZap className="h-4 w-4 text-emerald-500" />
                    )}
                    {METHOD_LABELS[allowedMethod]}
                    {connected ? (
                      <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {allowedMethod === "cdp-direct"
                      ? "No extension. A supported browser asks you to allow remote debugging."
                      : "Install once. Rearvy controls attached tabs through the relay."}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold"
              onClick={() => setGuideOpen((value) => !value)}
            >
              <span>Connection Guide</span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  guideOpen ? "rotate-90" : ""
                )}
              />
            </button>

            {guideOpen ? (
              <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                {method === "cdp-direct" ? (
                  <>
                    <div className="rounded-md bg-background/70 px-3 py-2">
                      Open <span className="font-mono">chrome://inspect/#remote-debugging</span>,
                      switch remote debugging on, then click <b>Allow</b> in the browser.
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
                      The browser will warn that an external app can control this session. Only allow it when you trust Rearvy Desktop.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-md bg-background/70 px-3 py-2">
                      Click <b>Send Request</b> to open Rearvy Browser Relay Setup. If the extension is installed, Rearvy applies the pairing code automatically.
                    </div>
                    <div className="rounded-md bg-background/70 px-3 py-2">
                      Open <span className="font-mono">chrome://extensions</span>, enable
                      Developer mode, open the extension folder, then drag the folder into Chrome, Edge, Brave, or another compatible Chromium browser.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void runBridgeAction("open-folder", (bridge) => {
                            if (!bridge.openExtensionFolder) {
                              throw new Error("Extension folder action is unavailable.");
                            }
                            return bridge.openExtensionFolder();
                          })
                        }
                        disabled={activeAction !== null}
                      >
                        <FolderOpen className="h-4 w-4" />
                        Open Folder
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void runBridgeAction("copy-path", (bridge) => {
                            if (!bridge.copyExtensionPath) {
                              throw new Error("Copy path action is unavailable.");
                            }
                            return bridge.copyExtensionPath();
                          })
                        }
                        disabled={activeAction !== null}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Path
                      </Button>
                    </div>
                    {pairingCode ? (
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-200">
                        Pairing code: <span className="font-mono font-semibold">{pairingCode}</span>
                      </div>
                    ) : null}
                  </>
                )}

                <div className="flex items-start gap-2 rounded-md bg-background/70 px-3 py-2">
                  <ShieldAlert className="mt-1 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{connectionSummary(effectiveStatus, method)}</span>
                </div>
              </div>
            ) : null}
          </div>

          {canRespond ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void sendRequest()}
                disabled={activeAction !== null || isSubmitting}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {activeAction ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Send Request
              </Button>
              <Button
                type="button"
                onClick={() => void submit("connected")}
                disabled={
                  isSubmitting ||
                  activeAction !== null ||
                  isRefreshing ||
                  !methodConnected(status, method)
                }
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Connected, Continue
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void refreshStatus()}
                disabled={isRefreshing || activeAction !== null}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
