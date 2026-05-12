/**
 * AI-Trader Trading Integration Status Component
 * Shows agent registration, published signals, copy-trading configs, and sync history
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  SendHorizontal,
  Copy,
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

export function AITraderDashboard() {
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/trading/ai-trader/register");
      const data = await response.json();
      setRegistration(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/trading/ai-trader/register", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        setRegistration({
          registered: true,
          agentId: data.agentId,
          status: "active",
          profile: data.profile,
        });
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration error");
    } finally {
      setLoading(false);
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
              <Button size="sm" variant="outline" className="w-full gap-2">
                <Copy className="h-4 w-4" />
                Publish Signal
              </Button>
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
              <Button size="sm" variant="outline" className="w-full gap-2">
                <Users className="h-4 w-4" />
                Follow Trader
              </Button>
            </CardContent>
          </Card>
        </div>
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
