/**
 * AI-Trader Trading Integration Status Component
 * Shows agent registration, published signals, copy-trading configs, and sync history
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AITraderSignal } from "@/types/ai-trader";
import { getErrorMessage } from "@/lib/error-utils";
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  SendHorizontal,
  Zap,
} from "lucide-react";

interface RegistrationData {
  registered: boolean;
  agentId?: string;
  status?: string;
  profile?: {
    winRate?: number;
    totalTrades?: number;
    followers?: number;
  };
  config?: {
    autoPublishSignals?: boolean;
    autoExecuteCopyTrades?: boolean;
  };
}

type RegistrationResponse = Partial<RegistrationData> & {
  success?: unknown;
  error?: unknown;
};

type TopSignalsResponse = {
  success?: unknown;
  error?: unknown;
  signals?: unknown;
  count?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getRegistrationProfile(value: unknown): RegistrationData["profile"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const profile: RegistrationData["profile"] = {};
  const winRate = getFiniteNumber(value.winRate);
  const totalTrades = getFiniteNumber(value.totalTrades);
  const followers = getFiniteNumber(value.followers);

  if (winRate !== undefined) {
    profile.winRate = winRate;
  }
  if (totalTrades !== undefined) {
    profile.totalTrades = totalTrades;
  }
  if (followers !== undefined) {
    profile.followers = followers;
  }

  return profile;
}

function getRegistrationConfig(value: unknown): RegistrationData["config"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const config: RegistrationData["config"] = {};
  const autoPublishSignals = getBoolean(value.autoPublishSignals);
  const autoExecuteCopyTrades = getBoolean(value.autoExecuteCopyTrades);

  if (autoPublishSignals !== undefined) {
    config.autoPublishSignals = autoPublishSignals;
  }
  if (autoExecuteCopyTrades !== undefined) {
    config.autoExecuteCopyTrades = autoExecuteCopyTrades;
  }

  return config;
}

function getRegistrationResponse(value: unknown): RegistrationResponse {
  if (!isRecord(value)) {
    return {};
  }

  const data: RegistrationResponse = {
    success: value.success,
    error: value.error,
  };
  const registered = getBoolean(value.registered);
  const agentId = getString(value.agentId);
  const status = getString(value.status);
  const profile = getRegistrationProfile(value.profile);
  const config = getRegistrationConfig(value.config);

  if (registered !== undefined) {
    data.registered = registered;
  }
  if (agentId) {
    data.agentId = agentId;
  }
  if (status) {
    data.status = status;
  }
  if (profile) {
    data.profile = profile;
  }
  if (config) {
    data.config = config;
  }

  return data;
}

function getTopSignalsResponse(value: unknown): TopSignalsResponse {
  if (!isRecord(value)) {
    return {};
  }

  return {
    success: value.success,
    error: value.error,
    signals: value.signals,
    count: value.count,
  };
}

async function readJsonRecord(response: Response) {
  return response.json().catch(() => null);
}

function getResponseError(data: { error?: unknown }, fallback: string) {
  return typeof data.error === "string" && data.error.trim() ? data.error : fallback;
}

function getSignalAction(value: unknown): AITraderSignal["action"] | null {
  return value === "Buy" || value === "Sell" || value === "Hold" ? value : null;
}

function getSignal(value: unknown): AITraderSignal | null {
  if (!isRecord(value)) {
    return null;
  }

  const agentId = getString(value.agentId);
  const symbol = getString(value.symbol);
  const action = getSignalAction(value.action);
  const confidence = getFiniteNumber(value.confidence);
  const timeframe = getString(value.timeframe);
  const reason = getString(value.reason);

  if (!agentId || !symbol || !action || confidence === undefined || !timeframe || !reason) {
    return null;
  }

  const signal: AITraderSignal = {
    agentId,
    symbol,
    action,
    confidence,
    timeframe,
    reason,
  };
  const id = getString(value.id);
  const entryPrice = getFiniteNumber(value.entryPrice);
  const stopLoss = getFiniteNumber(value.stopLoss);
  const takeProfit = getFiniteNumber(value.takeProfit);
  const riskReward = getFiniteNumber(value.riskReward);
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  if (id) {
    signal.id = id;
  }
  if (entryPrice !== undefined) {
    signal.entryPrice = entryPrice;
  }
  if (stopLoss !== undefined) {
    signal.stopLoss = stopLoss;
  }
  if (takeProfit !== undefined) {
    signal.takeProfit = takeProfit;
  }
  if (tags.length > 0) {
    signal.tags = tags;
  }
  if (riskReward !== undefined) {
    signal.riskReward = riskReward;
  }

  return signal;
}

function getSignals(value: unknown) {
  return Array.isArray(value) ? value.map(getSignal).filter((signal): signal is AITraderSignal => Boolean(signal)) : [];
}

export function AITraderDashboard() {
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"signals" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [topSignals, setTopSignals] = useState<AITraderSignal[]>([]);

  async function fetchStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/trading/ai-trader/register");
      const data = getRegistrationResponse(await readJsonRecord(response));
      if (!response.ok) {
        throw new Error(getResponseError(data, `Registration status request failed (${response.status})`));
      }

      setRegistration({
        registered: data.registered === true,
        ...(data.agentId ? { agentId: data.agentId } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.profile ? { profile: data.profile } : {}),
        ...(data.config ? { config: data.config } : {}),
      });
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch status"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRegister = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/trading/ai-trader/register", {
        method: "POST",
      });
      const data = getRegistrationResponse(await readJsonRecord(response));
      if (!response.ok) {
        throw new Error(getResponseError(data, `AI-Trader registration failed (${response.status})`));
      }

      if (data.success === true) {
        setRegistration({
          registered: true,
          ...(data.agentId ? { agentId: data.agentId } : {}),
          status: "active",
          ...(data.profile ? { profile: data.profile } : {}),
        });
        setError(null);
      } else {
        throw new Error(getResponseError(data, "Registration failed"));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Registration error"));
    } finally {
      setLoading(false);
    }
  };
  const handleLoadTopSignals = async () => {
    try {
      setActionLoading("signals");
      setActionMessage(null);
      setError(null);

      const response = await fetch(
        "/api/trading/ai-trader/market-intel?action=top-signals&symbol=BTC/USD"
      );
      const data = getTopSignalsResponse(await readJsonRecord(response));

      if (!response.ok || data.success !== true) {
        setError(getResponseError(data, "Failed to fetch top signals"));
        return;
      }

      const signals = getSignals(data.signals);
      const count = getFiniteNumber(data.count) ?? signals.length;
      setTopSignals(signals);
      setActionMessage(`Loaded ${count} top signals for BTC/USD.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to fetch top signals"));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Registration Status */}
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {registration?.registered ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Agent Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    Not Connected
                  </>
                )}
              </CardTitle>
              <CardDescription>AI-Trader platform integration status</CardDescription>
            </div>
            {!registration?.registered && (
              <Button onClick={handleRegister} disabled={loading}>
                Register Agent
              </Button>
            )}
          </div>
        </CardHeader>
        {registration?.registered && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Agent ID</p>
                <p className="mt-2 font-mono text-sm">{registration.agentId}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Status</p>
                <p className="mt-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-200">
                    {registration.status || "Active"}
                  </Badge>
                </p>
              </div>
            </div>

            {registration.profile && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className="font-semibold">{registration.profile.winRate || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                  <SendHorizontal className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Trades</p>
                    <p className="font-semibold">{registration.profile.totalTrades || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                  <Users className="h-5 w-5 text-cyan-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Followers</p>
                    <p className="font-semibold">{registration.profile.followers || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Features */}
      {registration?.registered && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <SendHorizontal className="h-5 w-5 text-blue-400" />
                Signal Publishing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Publish your trading opinions as signals to the AI-Trader community.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-publish"
                  checked={registration.config?.autoPublishSignals || false}
                  disabled
                  className="rounded"
                />
                <label htmlFor="auto-publish" className="text-sm">
                  Auto-publish signals ({registration.config?.autoPublishSignals ? "enabled" : "disabled"})
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-yellow-400" />
                Copy-Trading
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Follow top performers and mirror their trades automatically.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-execute"
                  checked={registration.config?.autoExecuteCopyTrades || false}
                  disabled
                  className="rounded"
                />
                <label htmlFor="auto-execute" className="text-sm">
                  Auto-execute copies ({registration.config?.autoExecuteCopyTrades ? "enabled" : "disabled"})
                </label>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={handleLoadTopSignals}
                disabled={actionLoading !== null}
              >
                <Users className="h-4 w-4" />
                {actionLoading === "signals" ? "Loading..." : "Load Top Signals"}
              </Button>
              {topSignals.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Top Signals</p>
                  <div className="space-y-2">
                    {topSignals.slice(0, 3).map((signal, index) => (
                      <div key={`${signal.agentId}-${signal.symbol}-${index}`} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{signal.symbol}</span>
                        <span>{signal.action}</span>
                        <span className="text-muted-foreground">{Math.round(signal.confidence * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {actionMessage && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-emerald-200">{actionMessage}</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-red-200">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
