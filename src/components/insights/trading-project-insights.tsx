"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react";

type BestTrade = {
  symbol: string;
  timeframe: string;
  action: "Buy" | "Sell";
  confidence: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  estimatedProfitPerUnit: number;
  estimatedProfitPct: number;
  estimatedRiskPerUnit: number;
  estimatedRiskPct: number;
  riskReward: number;
  score: number;
  analysisMode: "news_aligned" | "technical_with_news_context";
  nextOutcome: "bullish" | "bearish";
  nextOutcomeConfidence: number;
  researchBias: "bullish" | "bearish" | "mixed" | "neutral";
  researchSourceCount: number;
  marketDataSource: string;
  researchSummary?: string;
  reason: string;
  riskNotes: string;
  fetchedAt: number;
};

type BestTradesResponse = {
  ok: boolean;
  message?: string;
  bestTrades: BestTrade[];
  generatedAt?: number;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function TradingProjectInsights() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<BestTrade[]>([]);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    async function loadBestTrades() {
      try {
        setLoading(true);
        setError(null);

        const token = await user.getIdToken();
        const response = await fetch("/api/trading/insights/best-trades?limit=5", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load trades (${response.status})`);
        }

        const data = (await response.json()) as BestTradesResponse;
        if (cancelled) return;

        setTrades(data.bestTrades || []);
        setMessage(data.message || "");
      } catch (fetchError) {
        console.error("Error loading best trades insights:", fetchError);
        if (!cancelled) {
          setError("Unable to load trading insights right now.");
          setTrades([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBestTrades();

    const refreshInterval = setInterval(() => {
      void loadBestTrades();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [authLoading, user]);

  const hasTrades = trades.length > 0;

  const topTrade = useMemo(() => trades[0], [trades]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Trading Project Insights</CardTitle>
            <CardDescription>
              Live profitable trades with estimated profit per trade.
            </CardDescription>
          </div>
          {topTrade && (
            <Badge variant="default" className="font-semibold">
              Top: {topTrade.symbol} {topTrade.timeframe}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading best profitable trades...
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !hasTrades ? (
          <p className="text-sm text-muted-foreground">
            {message || "No valid trade setup found right now."}
          </p>
        ) : (
          <div className="space-y-3">
            {trades.map((trade, index) => {
              const isBuy = trade.action === "Buy";
              return (
                <div
                  key={`${trade.symbol}-${trade.timeframe}-${index}`}
                  className="rounded-lg border bg-card/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isBuy ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                      )}
                      <span className="font-semibold">
                        {index + 1}. {trade.symbol} ({trade.timeframe})
                      </span>
                      <Badge variant={isBuy ? "default" : "secondary"}>{trade.action}</Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {trade.analysisMode === "news_aligned"
                          ? "News aligned"
                          : "Technical + news context"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Signal {Math.round(trade.confidence * 100)}%
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm md:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Entry</p>
                      <p className="font-medium">{formatNumber(trade.entry)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Take Profit</p>
                      <p className="font-medium text-emerald-600">{formatNumber(trade.takeProfit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stop Loss</p>
                      <p className="font-medium text-rose-600">{formatNumber(trade.stopLoss)}</p>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Profit / Trade</p>
                      <p className="font-semibold text-emerald-600">
                        {formatNumber(trade.estimatedProfitPerUnit)} ({formatNumber(trade.estimatedProfitPct)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk / Trade</p>
                      <p className="font-semibold text-rose-600">
                        {formatNumber(trade.estimatedRiskPerUnit)} ({formatNumber(trade.estimatedRiskPct)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk:Reward</p>
                      <p className="font-semibold">1:{formatNumber(trade.riskReward)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ranking Score</p>
                      <p className="font-semibold">{formatNumber(trade.score)}</p>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Next Outcome (6-24h)</p>
                      <p className="font-semibold">
                        {trade.nextOutcome.toUpperCase()} ({Math.round(trade.nextOutcomeConfidence * 100)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Public News Bias</p>
                      <p className="font-semibold">
                        {trade.researchBias} ({trade.researchSourceCount} sources)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Market Data Source</p>
                      <p className="font-semibold">{trade.marketDataSource}</p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">{trade.reason}</p>
                  {trade.researchSummary && (
                    <p className="mt-1 text-xs text-muted-foreground/90">{trade.researchSummary}</p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              <ShieldAlert className="h-4 w-4" />
              Profit per trade is estimated from entry to take-profit for one unit. Actual results depend on slippage, fees, and execution.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
