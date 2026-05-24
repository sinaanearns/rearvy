"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import {
  normalizeChainId,
  normalizeEthAddress,
  validateTransactionLimit,
  weiDecimalToHex,
} from "@/lib/transactions/validation";
import { cn } from "@/lib/utils";

type OperationEvent = {
  id: string;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "system";
  source: string;
  message: string;
  payload?: Record<string, unknown> | null;
};

type OperationStatus = {
  available: boolean;
  running: boolean;
  pid: number | null;
  startedAt: string | null;
  lastEventAt: string | null;
  resource?: {
    memoryMb?: number;
    heapUsedMb?: number;
    uptimeSec?: number;
  };
  profile?: {
    name: string;
    mode: string;
    skills?: string[];
  };
  events: OperationEvent[];
};

type ProviderHealth = {
  id: string;
  name: string;
  costTier: "local" | "free" | "low" | "premium";
  configured: boolean;
  enabled: boolean;
  health?: {
    status: "available" | "configured" | "unconfigured" | "unreachable";
    reason?: string;
    latencyMs?: number;
  };
};

type RouterHealth = {
  ok: boolean;
  providers: ProviderHealth[];
};

type ConnectionState = "checking" | "browser" | "connected" | "error";

type TransactionRequestSummary = {
  id: string;
  status:
    | "draft"
    | "awaiting_approval"
    | "approved"
    | "rejected"
    | "submitted"
    | "failed";
  from_address: string | null;
  to_address: string;
  chain_id: string | null;
  network_name: string | null;
  amount_eth?: string;
  amount_wei: string;
  human_amount?: string;
  amount_display?: string;
  reason: string;
  risk_summary: string;
  approved_at: string | null;
  rejected_at: string | null;
  submitted_at: string | null;
  tx_hash: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type TransactionRequestsPayload = {
  ok: boolean;
  requests: TransactionRequestSummary[];
};

type AutomationApprovalRun = {
  id: string;
  script_name: string | null;
  source: "script" | "adhoc";
  status: "awaiting_approval" | "queued" | "running" | "completed" | "failed" | "canceled";
  risk_level: "low" | "medium" | "high";
  allow_network: boolean;
  max_runtime_seconds: number;
  requested_by: string | null;
  created_at: string;
};

type AutomationRunsPayload = {
  runs: AutomationApprovalRun[];
};

type WalletProfile = {
  metamask_address?: string | null;
  metamask_chain_id?: string | null;
  metamask_network?: string | null;
  metamask_eth_balance?: number | null;
  metamask_eur_balance?: number | null;
  execution_budget_eur?: number | null;
};

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function isOperationEvent(value: unknown): value is OperationEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const event = value as Partial<OperationEvent>;
  return (
    typeof event.id === "string" &&
    typeof event.timestamp === "string" &&
    typeof event.message === "string"
  );
}

function isOperationStatus(value: unknown): value is OperationStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const status = value as Partial<OperationStatus>;
  return (
    typeof status.available === "boolean" &&
    typeof status.running === "boolean" &&
    Array.isArray(status.events)
  );
}

function isRouterHealth(value: unknown): value is RouterHealth {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const health = value as Partial<RouterHealth>;
  return health.ok === true && Array.isArray(health.providers);
}

function isTransactionRequest(value: unknown): value is TransactionRequestSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const request = value as Partial<TransactionRequestSummary>;
  return (
    typeof request.id === "string" &&
    typeof request.status === "string" &&
    typeof request.to_address === "string" &&
    typeof request.amount_wei === "string"
  );
}

function isTransactionRequestsPayload(value: unknown): value is TransactionRequestsPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<TransactionRequestsPayload>;
  return payload.ok === true && Array.isArray(payload.requests);
}

function isAutomationRun(value: unknown): value is AutomationApprovalRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const run = value as Partial<AutomationApprovalRun>;
  return (
    typeof run.id === "string" &&
    run.status === "awaiting_approval" &&
    typeof run.risk_level === "string"
  );
}

function isAutomationRunsPayload(value: unknown): value is AutomationRunsPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<AutomationRunsPayload>;
  return Array.isArray(payload.runs);
}

function getWalletProfile(value: unknown): WalletProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as { profile?: unknown };
  if (!payload.profile || typeof payload.profile !== "object" || Array.isArray(payload.profile)) {
    return null;
  }

  return payload.profile as WalletProfile;
}

function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return provider || null;
}

function shortAddress(address: string | null | undefined) {
  if (!address) {
    return "Not set";
  }

  return address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;
}

function getTransactionAmount(request: TransactionRequestSummary) {
  return request.human_amount || request.amount_display || `${request.amount_eth || "0"} ETH`;
}

function getTransactionAmountEth(request: TransactionRequestSummary) {
  if (typeof request.amount_eth === "string" && request.amount_eth.trim()) {
    return request.amount_eth.trim();
  }

  const match = (request.human_amount || request.amount_display || "").match(
    /(\d+(?:\.\d+)?)/
  );
  return match?.[1] || "";
}

function statusLabel(status: TransactionRequestSummary["status"]) {
  return status.replace(/_/g, " ");
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs)) {
    return "Unknown";
  }

  const diffSec = Math.max(Math.floor(diffMs / 1000), 0);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

function providerTone(provider: ProviderHealth) {
  if (provider.health?.status === "available" || provider.health?.status === "configured") {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (provider.health?.status === "unreachable") {
    return "text-amber-600 dark:text-amber-400";
  }

  return "text-slate-500 dark:text-slate-400";
}

function levelClass(level: OperationEvent["level"]) {
  if (level === "error") {
    return "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200";
  }

  if (level === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  }

  if (level === "system") {
    return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200";
  }

  return "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200";
}

export function OperationsConsole() {
  const { user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [localApiBase, setLocalApiBase] = useState<string | null>(null);
  const [status, setStatus] = useState<OperationStatus | null>(null);
  const [routerHealth, setRouterHealth] = useState<RouterHealth | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionRequests, setTransactionRequests] = useState<TransactionRequestSummary[]>([]);
  const [automationRuns, setAutomationRuns] = useState<AutomationApprovalRun[]>([]);
  const [walletProfile, setWalletProfile] = useState<WalletProfile | null>(null);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);

  const configuredProviderCount = useMemo(
    () =>
      routerHealth?.providers.filter(
        (provider) =>
          provider.configured &&
          provider.health?.status !== "unreachable"
      ).length ?? 0,
    [routerHealth]
  );
  const recentEvents = useMemo(
    () => (status?.events || []).slice(-80).reverse(),
    [status]
  );
  const pendingApprovalCount = useMemo(
    () =>
      automationRuns.length +
      transactionRequests.filter(
        (request) =>
          request.status === "awaiting_approval" || request.status === "approved"
      ).length,
    [automationRuns.length, transactionRequests]
  );

  const fetchRouterHealth = useCallback(async () => {
    const response = await fetch("/api/ai/model-router/health", {
      cache: "no-store",
      headers: localApiBase ? { "x-rearvy-desktop": "1" } : undefined,
    });
    const payload = await response.json();
    if (isRouterHealth(payload)) {
      setRouterHealth(payload);
    }
  }, [localApiBase]);

  const fetchLocalStatus = useCallback(async (baseUrl: string) => {
    const response = await fetch(`${baseUrl}/api/internal/operations/status`, {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!isOperationStatus(payload)) {
      throw new Error("Operations status response was malformed.");
    }

    setStatus(payload);
    setConnectionState("connected");
    setError(null);
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      return null;
    }

    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const fetchApprovals = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) {
      setTransactionRequests([]);
      setAutomationRuns([]);
      setWalletProfile(null);
      return;
    }

    setApprovalsLoading(true);

    try {
      const [requestsResponse, profileResponse, automationResponse] = await Promise.all([
        fetch("/api/transactions/requests?status=open&limit=8", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/dashboard/profile", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/automation/python/runs?status=awaiting_approval&limit=5", {
          cache: "no-store",
          headers,
        }),
      ]);

      const requestsPayload = await requestsResponse.json();
      if (requestsResponse.ok && isTransactionRequestsPayload(requestsPayload)) {
        setTransactionRequests(requestsPayload.requests.filter(isTransactionRequest));
      }

      const profilePayload = await profileResponse.json();
      if (profileResponse.ok) {
        setWalletProfile(getWalletProfile(profilePayload));
      }

      const automationPayload = await automationResponse.json();
      if (automationResponse.ok && isAutomationRunsPayload(automationPayload)) {
        setAutomationRuns(automationPayload.runs.filter(isAutomationRun));
      }
    } catch (approvalError) {
      console.error("Failed to load approvals:", approvalError);
    } finally {
      setApprovalsLoading(false);
    }
  }, [getAuthHeaders]);

  const patchTransactionRequest = useCallback(
    async (requestId: string, body: Record<string, unknown>) => {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error("Sign in to manage transaction approvals.");
      }

      const response = await fetch(`/api/transactions/requests/${requestId}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error || "")
            : "";
        throw new Error(message || "Failed to update transaction request.");
      }

      await fetchApprovals();
      return payload;
    },
    [fetchApprovals, getAuthHeaders]
  );

  const patchAutomationRun = useCallback(
    async (runId: string, action: "approve" | "reject") => {
      const headers = await getAuthHeaders();
      if (!headers) {
        throw new Error("Sign in to manage automation approvals.");
      }

      const response = await fetch(`/api/automation/python/runs/${runId}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error || "")
            : "";
        throw new Error(message || "Failed to update automation approval.");
      }

      await fetchApprovals();
      return payload;
    },
    [fetchApprovals, getAuthHeaders]
  );

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setConnectionState("checking");
      setError(null);

      try {
        const port = await window.electron?.localApiPort?.();
        if (!port) {
          if (!cancelled) {
            setConnectionState("browser");
            setLocalApiBase(null);
          }
          return;
        }

        const baseUrl = `http://127.0.0.1:${port}`;
        if (!cancelled) {
          setLocalApiBase(baseUrl);
        }
        await fetchLocalStatus(baseUrl);
      } catch (connectError) {
        if (!cancelled) {
          setConnectionState("error");
          setError(
            connectError instanceof Error
              ? connectError.message
              : "Failed to connect to the desktop Operations runtime."
          );
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
    };
  }, [fetchLocalStatus]);

  useEffect(() => {
    void fetchRouterHealth().catch((healthError) => {
      console.error("Failed to load model router health:", healthError);
    });
  }, [fetchRouterHealth]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  useEffect(() => {
    if (!localApiBase) {
      return;
    }

    const eventSource = new EventSource(
      `${localApiBase}/api/internal/operations/events`
    );

    eventSource.addEventListener("status", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (isOperationStatus(payload)) {
          setStatus(payload);
        }
      } catch {
        // Ignore malformed local status events.
      }
    });

    eventSource.addEventListener("operations", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (isOperationEvent(payload)) {
          setStatus((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              lastEventAt: payload.timestamp,
              events: [...current.events, payload].slice(-120),
            };
          });
        }
      } catch {
        // Ignore malformed local operation events.
      }
    });

    eventSource.onerror = () => {
      setError("Live Operations event stream disconnected.");
    };

    return () => {
      eventSource.close();
    };
  }, [localApiBase]);

  const startOperations = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      let targetUrl = "/api/internal/operations/start";

      if (localApiBase) {
        targetUrl = `${localApiBase}/api/internal/operations/start`;
        if (user?.uid) {
          headers["x-rearvy-user-id"] = user.uid;
        }
      } else {
        const token = await user?.getIdToken();
        if (!token) {
          throw new Error("Sign in to arm cloud Operations.");
        }
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ chatId: "operations-console" }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      if (localApiBase) {
        await fetchLocalStatus(localApiBase);
      }
      await fetchApprovals();

      toast.success("Operations runtime armed.");
    } catch (startError) {
      const message =
        startError instanceof Error
          ? startError.message
          : "Failed to arm Operations runtime.";
      setError(message);
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  }, [fetchApprovals, fetchLocalStatus, localApiBase, user]);

  const updateApproval = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      setApprovalActionId(`${requestId}:${action}`);

      try {
        await patchTransactionRequest(requestId, {
          action,
          ...(action === "reject" ? { error: "Rejected by user." } : {}),
        });
        toast.success(
          action === "approve"
            ? "Transaction draft approved."
            : "Transaction draft rejected."
        );
      } catch (approvalError) {
        const message =
          approvalError instanceof Error
            ? approvalError.message
            : "Failed to update approval.";
        toast.error(message);
      } finally {
        setApprovalActionId(null);
      }
    },
    [patchTransactionRequest]
  );

  const updateAutomationApproval = useCallback(
    async (runId: string, action: "approve" | "reject") => {
      setApprovalActionId(`${runId}:automation:${action}`);

      try {
        await patchAutomationRun(runId, action);
        toast.success(
          action === "approve"
            ? "Automation run approved and queued."
            : "Automation run rejected."
        );
      } catch (approvalError) {
        const message =
          approvalError instanceof Error
            ? approvalError.message
            : "Failed to update automation approval.";
        toast.error(message);
      } finally {
        setApprovalActionId(null);
      }
    },
    [patchAutomationRun]
  );

  const submitWithMetaMask = useCallback(
    async (request: TransactionRequestSummary) => {
      setApprovalActionId(`${request.id}:submit`);
      let sendPromptStarted = false;

      try {
        if (request.status !== "approved") {
          throw new Error("Approve this transaction draft before submitting it.");
        }

        const ethereum = getEthereumProvider();
        if (!ethereum) {
          throw new Error("MetaMask is not available in this browser or desktop renderer.");
        }

        const toAddress = normalizeEthAddress(request.to_address);
        if (!toAddress) {
          throw new Error("Recipient address is invalid.");
        }

        const amountEth = getTransactionAmountEth(request);
        if (!amountEth) {
          throw new Error("Transaction amount is invalid.");
        }

        const value = weiDecimalToHex(request.amount_wei);
        let accounts = await ethereum.request({ method: "eth_accounts" });
        if (!Array.isArray(accounts) || accounts.length === 0) {
          accounts = await ethereum.request({ method: "eth_requestAccounts" });
        }

        const fromAddress = normalizeEthAddress(
          Array.isArray(accounts) ? accounts[0] : null
        );
        if (!fromAddress) {
          throw new Error("No MetaMask account is connected.");
        }

        if (
          request.from_address &&
          request.from_address.toLowerCase() !== fromAddress.toLowerCase()
        ) {
          throw new Error("Connected MetaMask account does not match the approved sender.");
        }

        const chainId = normalizeChainId(
          await ethereum.request({ method: "eth_chainId" })
        );
        if (!chainId) {
          throw new Error("MetaMask chain id is unavailable.");
        }

        if (
          request.chain_id &&
          request.chain_id.toLowerCase() !== chainId.toLowerCase()
        ) {
          throw new Error("Connected MetaMask chain does not match the approved chain.");
        }

        const limitCheck = validateTransactionLimit({
          amountEth,
          transactionLimitEur: walletProfile?.execution_budget_eur ?? null,
          walletEthBalance: walletProfile?.metamask_eth_balance ?? null,
          walletEurBalance: walletProfile?.metamask_eur_balance ?? null,
        });
        if (!limitCheck.ok) {
          throw new Error(limitCheck.reason || "Transaction limit check failed.");
        }

        sendPromptStarted = true;
        const txHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: fromAddress,
              to: toAddress,
              value,
            },
          ],
        });

        if (typeof txHash !== "string") {
          throw new Error("MetaMask did not return a transaction hash.");
        }

        await patchTransactionRequest(request.id, {
          action: "submit",
          txHash,
          fromAddress,
          chainId,
        });
        toast.success("Transaction submitted through MetaMask.");
      } catch (submitError) {
        const message =
          submitError instanceof Error
            ? submitError.message
            : "Failed to submit transaction.";
        toast.error(message);

        if (sendPromptStarted) {
          await patchTransactionRequest(request.id, {
            action: "fail",
            error: message,
          }).catch((patchError) => {
            console.error("Failed to record transaction failure:", patchError);
          });
        }
      } finally {
        setApprovalActionId(null);
      }
    },
    [patchTransactionRequest, walletProfile]
  );

  const runtimeBadge =
    connectionState === "connected"
      ? status?.running
        ? "Armed"
        : "Ready"
      : connectionState === "checking"
        ? "Checking"
        : "Cloud only";

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-lg py-4">
          <CardHeader className="px-4 pb-1">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Runtime
              </span>
              <Badge variant="outline">{runtimeBadge}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">
              {status?.profile?.name || "Business Ops Runtime"}
            </div>
            <div>{connectionState === "connected" ? "Desktop local API" : "Cloud event queue"}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg py-4">
          <CardHeader className="px-4 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              Wake Model
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Event driven</div>
            <div>Last event {formatRelativeTime(status?.lastEventAt)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg py-4">
          <CardHeader className="px-4 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Providers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">
              {configuredProviderCount} configured
            </div>
            <div>Local and free providers first</div>
          </CardContent>
        </Card>

        <Card className="rounded-lg py-4">
          <CardHeader className="px-4 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Resource
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">
              {typeof status?.resource?.memoryMb === "number"
                ? `${status.resource.memoryMb} MB`
                : "Local cache ready"}
            </div>
            <div>
              {typeof status?.resource?.uptimeSec === "number"
                ? `${status.resource.uptimeSec}s uptime`
                : "SQLite when available"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 xl:grid xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-h-[320px] rounded-lg py-4">
          <CardHeader className="flex-row items-center justify-between px-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {connectionState === "connected" ? (
                <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="h-4 w-4 text-slate-500" />
              )}
              Operations Stream
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void fetchRouterHealth();
                  void fetchApprovals();
                  if (localApiBase) {
                    void fetchLocalStatus(localApiBase);
                  }
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void startOperations()}
                disabled={isStarting}
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Arm
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col px-4">
            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="min-h-[240px] flex-1 overflow-y-auto rounded-lg border bg-slate-50 p-3 dark:bg-slate-950">
              {connectionState === "checking" ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking runtime...
                </div>
              ) : recentEvents.length > 0 ? (
                <div className="space-y-2">
                  {recentEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm",
                        levelClass(event.level)
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs opacity-80">
                        <span className="font-medium">{event.source}</span>
                        <span>{formatRelativeTime(event.timestamp)}</span>
                      </div>
                      <div className="break-words">{event.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Waiting for queued business events.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="rounded-lg py-4">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <WalletCards className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Approvals
                </span>
                <Badge variant="outline">{pendingApprovalCount}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 text-sm">
              <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>MetaMask</span>
                  <span className="truncate font-medium text-foreground">
                    {walletProfile?.metamask_address
                      ? shortAddress(walletProfile.metamask_address)
                      : "Not connected"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span>Limit</span>
                  <span className="font-medium text-foreground">
                    {walletProfile?.execution_budget_eur
                      ? `EUR ${walletProfile.execution_budget_eur.toLocaleString()}`
                      : "No cap set"}
                  </span>
                </div>
              </div>

              {approvalsLoading ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-3 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading approvals.
                </div>
              ) : transactionRequests.length === 0 && automationRuns.length === 0 ? (
                <div className="rounded-md border px-3 py-3 text-muted-foreground">
                  No pending automation or transaction drafts.
                </div>
              ) : (
                <div className="space-y-2">
                  {automationRuns.map((run) => {
                    const approving =
                      approvalActionId === `${run.id}:automation:approve`;
                    const rejecting =
                      approvalActionId === `${run.id}:automation:reject`;

                    return (
                      <div key={run.id} className="rounded-md border px-3 py-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {run.script_name || "Adhoc automation run"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {run.risk_level} risk - {run.max_runtime_seconds}s max
                              {run.allow_network ? " - network allowed" : ""}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 capitalize">
                            Automation
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Awaiting approval since {formatRelativeTime(run.created_at)}.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void updateAutomationApproval(run.id, "approve")}
                            disabled={Boolean(approvalActionId)}
                          >
                            {approving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void updateAutomationApproval(run.id, "reject")}
                            disabled={Boolean(approvalActionId)}
                          >
                            {rejecting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {transactionRequests.map((request) => {
                    const approving = approvalActionId === `${request.id}:approve`;
                    const rejecting = approvalActionId === `${request.id}:reject`;
                    const submitting = approvalActionId === `${request.id}:submit`;

                    return (
                      <div key={request.id} className="rounded-md border px-3 py-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {getTransactionAmount(request)}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              To {shortAddress(request.to_address)}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 capitalize">
                            {statusLabel(request.status)}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="line-clamp-2">{request.reason}</div>
                          <div className="line-clamp-2">{request.risk_summary}</div>
                          {request.error && (
                            <div className="text-red-600 dark:text-red-400">
                              {request.error}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {request.status === "awaiting_approval" && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void updateApproval(request.id, "approve")}
                              disabled={Boolean(approvalActionId)}
                            >
                              {approving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              Approve
                            </Button>
                          )}
                          {request.status === "approved" && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void submitWithMetaMask(request)}
                              disabled={Boolean(approvalActionId)}
                            >
                              {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              Submit
                            </Button>
                          )}
                          {(request.status === "awaiting_approval" ||
                            request.status === "approved") && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void updateApproval(request.id, "reject")}
                              disabled={Boolean(approvalActionId)}
                            >
                              {rejecting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              Reject
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg py-4">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Automation Safety
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 text-sm">
              {[
                ["Layer 1", "Insights only"],
                ["Layer 2", "Approval required"],
                ["Layer 3", "Low-risk policy actions"],
                ["Layer 4", "Scoped desktop autonomy"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="min-h-0 rounded-lg py-4">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                Model Router
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[320px] space-y-2 overflow-y-auto px-4 text-sm">
              {routerHealth?.providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{provider.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {provider.costTier}
                    </div>
                  </div>
                  <div className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", providerTone(provider))}>
                    {provider.configured ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5" />
                    )}
                    {provider.health?.status || "unknown"}
                  </div>
                </div>
              )) || (
                <div className="text-sm text-muted-foreground">
                  Loading provider health.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
