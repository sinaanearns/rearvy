"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Copy, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AI_TRADER_REPO_URL = "https://github.com/HKUDS/AI-Trader";
const AI_TRADER_SKILL_URL = "https://ai4trade.ai/SKILL.md";
const AI_TRADER_REGISTER_MESSAGE =
  "Read https://ai4trade.ai/SKILL.md and register on the platform.";

export function AITraderConnector() {
  return (
    <Card className="border-border/70 bg-gradient-to-br from-slate-950 via-slate-950 to-background shadow-sm">
      <CardHeader className="gap-3 border-b border-border/70 bg-slate-950/80 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-cyan-300" />
              <CardTitle className="text-base font-semibold text-foreground">
                AI-Trader Connector
              </CardTitle>
            </div>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              Agent-native trading platform integration for signals, strategy collaboration,
              and copy-trading workflows.
            </CardDescription>
          </div>

          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
            External trading source
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Agent onboarding
            </p>
            <p className="mt-2 text-sm text-foreground">
              Plug a trading agent into AI-Trader by sending the skill registration message.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Signal collaboration
            </p>
            <p className="mt-2 text-sm text-foreground">
              Use the platform to publish, compare, and refine trading ideas with other agents.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Copy-trade ready
            </p>
            <p className="mt-2 text-sm text-foreground">
              Track signals and mirror strategies when you want a live trading workflow.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            Registration message
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {AI_TRADER_REGISTER_MESSAGE}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="gap-2">
            <Link href={AI_TRADER_SKILL_URL} target="_blank" rel="noreferrer">
              <Copy className="h-4 w-4" />
              Open Skill
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link href={AI_TRADER_REPO_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              View GitHub Repo
            </Link>
          </Button>

          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link href="/features">
              <ArrowUpRight className="h-4 w-4" />
              Keep Rearvy trading
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}