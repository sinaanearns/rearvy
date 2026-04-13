"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTradingPrice } from "@/lib/trading/price-format";

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

function formatNumber(value: number, symbol?: string): string {
  return formatTradingPrice(value, symbol);
}

export function TradingProjectInsights() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<BestTrade[]>([]);
  const [message, setMessage] = useState<string>("");
  const [refreshSeconds, setRefreshSeconds] = useState<1 | 5 | 10 | 20>(1);
  const lastAlertedTradeKeyRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  const playAlertSound = async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      const context = audioContextRef.current;
      if (context.state === "suspended") {
        await context.resume();
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.32);
    } catch (soundError) {
      console.warn("Could not play trade alert sound:", soundError);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;
    const currentUser = user;

    let cancelled = false;

    async function loadBestTrades() {
      try {
        setLoading(true);
        setError(null);

        const token = await currentUser.getIdToken();
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
    }, refreshSeconds * 1000);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
      audioContextRef.current = null;
    };
  }, [authLoading, user, refreshSeconds]);

  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;

      try {
        const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }
      } catch (soundError) {
        console.warn("Could not unlock trade alert audio:", soundError);
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!trades.length) return;

    const topTrade = trades[0];
    const tradeKey = `${topTrade.symbol}-${topTrade.timeframe}-${topTrade.action}-${topTrade.fetchedAt}`;
    const isHighConviction =
      topTrade.analysisMode === "news_aligned" &&
      topTrade.confidence >= 0.8 &&
      topTrade.nextOutcomeConfidence >= 0.75 &&
      topTrade.score >= 2.5;

    if (!isHighConviction) {
      lastAlertedTradeKeyRef.current = null;
      return;
    }

    if (lastAlertedTradeKeyRef.current === tradeKey) return;

    lastAlertedTradeKeyRef.current = tradeKey;
    void playAlertSound();
  }, [trades]);

  const hasTrades = trades.length > 0;

  const topTrade = useMemo(() => trades[0], [trades]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Trading Project Insights</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(refreshSeconds)}
              onValueChange={(value) => setRefreshSeconds(Number(value) as 1 | 5 | 10 | 20)}
            >
              <SelectTrigger className="h-8 w-[118px]">
                <SelectValue placeholder="Refresh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 sec</SelectItem>
                <SelectItem value="5">5 sec</SelectItem>
                <SelectItem value="10">10 sec</SelectItem>
                <SelectItem value="20">20 sec</SelectItem>
              </SelectContent>
            </Select>
            {topTrade && (
              <Badge variant="default" className="font-semibold">
                Top: {topTrade.symbol} {topTrade.timeframe}
              </Badge>
            )}
          </div>
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
                      <p className="font-medium">{formatNumber(trade.entry, trade.symbol)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Take Profit</p>
                      <p className="font-medium text-emerald-600">{formatNumber(trade.takeProfit, trade.symbol)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stop Loss</p>
                      <p className="font-medium text-rose-600">{formatNumber(trade.stopLoss, trade.symbol)}</p>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Profit / Trade</p>
                      <p className="font-semibold text-emerald-600">
                        {formatNumber(trade.estimatedProfitPerUnit, trade.symbol)} ({trade.estimatedProfitPct.toFixed(2)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk / Trade</p>
                      <p className="font-semibold text-rose-600">
                        {formatNumber(trade.estimatedRiskPerUnit, trade.symbol)} ({trade.estimatedRiskPct.toFixed(2)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk:Reward</p>
                      <p className="font-semibold">1:{trade.riskReward.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ranking Score</p>
                      <p className="font-semibold">{trade.score.toFixed(2)}</p>
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
