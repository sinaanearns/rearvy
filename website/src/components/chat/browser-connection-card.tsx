"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

type ToolOutputHandler = (params: {
  tool: string;
  toolCallId: string;
  output: unknown;
}) => void | PromiseLike<void>;

type BrowserConnectionMethod =
  | "cdp-direct"
  | "extension-relay"
  | "managed-runner";

type BrowserConnectionCardProps = {
  toolCallId?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  onToolOutput?: ToolOutputHandler;
};

type BrowserBridge = {
  getConnectionStatus?: () => Promise<BrowserConnectionStatus>;
  openChromeInternalUrl?: (url: string) => Promise<unknown>;
  openExtensionFolder?: () => Promise<unknown>;
  copyExtensionPath?: () => Promise<unknown>;
  createRelayPairingCode?: () => Promise<{ ok?: boolean; pairingCode?: string; error?: string }>;
  getRelayInfo?: () => Promise<BrowserRelayInfo>;
};

type BrowserRelayInfo = {
  ok?: boolean;
  port?: number;
  extensionPath?: string;
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
      "Rearvy needs a connected Chrome browser before it can continue this browser task.",
    preferredMethod:
      firstString(record.preferredMethod) === "extension-relay"
        ? "extension-relay"
        : "cdp-direct",
    allowedMethods: normalizeMethods(record.allowedMethods),
    requireFunctionalControl: record.requireFunctionalControl !== false,
  };
}

function getOutputStatus(output: unknown) {
  const record = asRecord(output);
  const status = firstString(record?.status);
  if (status === "connected" || status === "skipped" || status === "failed") {
    return status;
  }

  return null;
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
      return status.cdpDirect.browser || "Chrome remote debugging is available.";
    }

    return status?.cdpDirect?.error || "Chrome DevTools Protocol is not connected.";
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

export function BrowserConnectionCard({
  toolCallId,
  state,
  input,
  output,
  onToolOutput,
}: BrowserConnectionCardProps) {
  const cardInput = useMemo(() => getInput(input), [input]);
  const outputStatus = getOutputStatus(output);
  const [method, setMethod] = useState<BrowserConnectionMethod>(
    cardInput.preferredMethod
  );
  const [status, setStatus] = useState<BrowserConnectionStatus | null>(null);
  const [relayInfo, setRelayInfo] = useState<BrowserRelayInfo | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const isComplete = outputStatus !== null;
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
          error: "Open Rearvy Desktop to connect a local Chrome browser.",
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
    void refreshStatus();
    const interval = setInterval(() => void refreshStatus(), 2000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

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
        if (!bridge.openChromeInternalUrl) {
          throw new Error("Opening Chrome setup pages is unavailable.");
        }
        return bridge.openChromeInternalUrl("chrome://inspect/#remote-debugging");
      });
      return;
    }

    if (method === "extension-relay") {
      await runBridgeAction("pair-extension", async (bridge) => {
        if (bridge.createRelayPairingCode) {
          const created = await bridge.createRelayPairingCode();
          if (created.pairingCode) {
            setPairingCode(created.pairingCode);
          }
        }
        if (!bridge.openChromeInternalUrl) {
          throw new Error("Opening Chrome setup pages is unavailable.");
        }
        return bridge.openChromeInternalUrl("chrome://extensions");
      });
    }
  };

  const submit = async (nextStatus: "connected" | "skipped" | "failed") => {
    if (!toolCallId || !onToolOutput || isSubmitting) {
      return;
    }

    if (nextStatus === "connected" && !methodConnected(status, method)) {
      toast.error(connectionSummary(status, method));
      return;
    }

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
      toast.error(error instanceof Error ? error.message : "Could not continue.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
                {methodConnected(status, method) ? "Connected" : "Browser not connected"}
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
              const connected = methodConnected(status, allowedMethod);
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
                      ? "No extension. Chrome asks you to allow remote debugging."
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
                      switch remote debugging on, then click <b>Allow</b> in Chrome.
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
                      Chrome will warn that an external app can control this session. Only allow it when you trust Rearvy Desktop.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-md bg-background/70 px-3 py-2">
                      Open <span className="font-mono">chrome://extensions</span>, enable
                      Developer mode, open the extension folder, then drag the folder into Chrome.
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
                  <span>{connectionSummary(status, method)}</span>
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
