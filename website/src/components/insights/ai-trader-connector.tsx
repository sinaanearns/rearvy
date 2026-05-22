"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Copy, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AI_TRADER_REPO_URL = "https://github.com/HKUDS/AI-Trader";
const AI_TRADER_SKILL_URL = "https://ai4trade.ai/SKILL.md";
const AI_TRADER_REGISTER_MESSAGE =
  "Read https://ai4trade.ai/SKILL.md and register on the platform.";

export function AITraderConnector() {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);

  async function checkRegistrationStatus() {
    try {
      const response = await fetch("/api/trading/ai-trader/register");
      const data = await response.json();
      setRegistered(data.registered || false);
      setAgentId(data.agentId || null);
    } catch (error) {
      console.error("Failed to check AI-Trader registration status:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const handleRegister = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/trading/ai-trader/register", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        setRegistered(true);
        setAgentId(data.agentId);
      }
    } catch (error) {
      console.error("Failed to register with AI-Trader:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/70 bg-gradient-to-br from-slate-950 via-slate-950 to-background shadow-sm">
      <CardHeader className="gap-3 border-b border-border/70 bg-slate-950/80 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-cyan-300" />
              <CardTitle className="text-base font-semibold text-foreground">
                AI-Trader Agent Integration
              </CardTitle>
            </div>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              100% fully-automated agent-native trading platform for signals, strategy
              collaboration, and copy-trading.
            </CardDescription>
          </div>

          <Badge
            variant="outline"
            className={
              registered
                ? "border-green-500/30 bg-green-500/10 text-green-200"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
            }
          >
            {registered ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Not Connected
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Signal Publishing
            </p>
            <p className="mt-2 text-sm text-foreground">
              Publish your trading opinions to the AI-Trader community and earn rewards.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Copy-Trading
            </p>
            <p className="mt-2 text-sm text-foreground">
              Follow top traders and automatically mirror their trades with position sizing.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Market Intelligence
            </p>
            <p className="mt-2 text-sm text-foreground">
              Access real-time signals, community insights, and top performers for any symbol.
            </p>
          </div>
        </div>

        {registered && agentId && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-200">
              Agent ID
            </p>
            <p className="mt-2 font-mono text-sm text-foreground">{agentId}</p>
          </div>
        )}

        {!registered && (
          <div className="rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              Registration Required
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Connect your Rearvy agent to AI-Trader to publish signals, follow traders, and
              automate copy-trading.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!registered ? (
            <Button onClick={handleRegister} size="sm" className="gap-2" disabled={loading}>
              {loading ? "Connecting..." : "Register Agent"}
            </Button>
          ) : (
            <Button asChild size="sm" variant="default" className="gap-2">
              <Link href="/trading/ai-trader" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                View AI-Trader Dashboard
              </Link>
            </Button>
          )}

          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link href={AI_TRADER_REPO_URL} target="_blank" rel="noreferrer">
              <Copy className="h-4 w-4" />
              GitHub Repo
            </Link>
          </Button>

          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link href="https://ai4trade.ai" target="_blank" rel="noreferrer">
              <ArrowUpRight className="h-4 w-4" />
              AI-Trader Live
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
