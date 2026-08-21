import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";
import type { Timeframe } from "@/types/trading";

type TraderSignalDoc = {
  user_id?: string;
  asset?: string;
  symbol?: string;
  direction?: string;
  action?: string;
  timeframe?: string;
  time_frame?: string;
  entry?: number | null;
  trader_name?: string;
  traderName?: string;
  firm_name?: string;
  firmName?: string;
  status?: string;
  opened_at?: string | number | Date | null;
  openedAt?: string | number | Date | null;
  closed_at?: string | number | Date | null;
  closedAt?: string | number | Date | null;
  reason?: string;
  source_reason?: string;
  sourceReason?: string;
  source_url?: string;
  sourceUrl?: string;
  credibility_score?: number;
  credibilityScore?: number;
  historical_performance?: number;
  historicalPerformance?: number;
  risk_consistency?: number;
  riskConsistency?: number;
  drawdown?: number;
  max_drawdown?: number;
  maxDrawdown?: number;
};

type NormalizedSignal = {
  id: string;
  asset: string;
  direction: "Buy" | "Sell";
  timeframe: Timeframe | null;
  entry: number | null;
  traderName: string;
  firmName: string;
  status: "open" | "closed";
  openedAt: number | null;
  closedAt: number | null;
  reason: string | null;
  sourceUrl: string | null;
  credibilityScore: number;
  metrics: {
    historicalPerformance: number | null;
    riskConsistency: number | null;
    drawdown: number | null;
  };
};

const NO_DATA_MESSAGE = "No confirmed professional trader signals at this time.";

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const maybeToDate = (value as { toDate?: () => Date }).toDate;
    if (typeof maybeToDate === "function") {
      const date = maybeToDate();
      const time = date.getTime();
      return Number.isFinite(time) ? time : null;
    }
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDirection(value: unknown): "Buy" | "Sell" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "buy" || normalized === "long") {
    return "Buy";
  }

  if (normalized === "sell" || normalized === "short") {
    return "Sell";
  }

  return null;
}

function normalizeTimeframe(value: unknown): Timeframe | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === "M15" ||
    normalized === "M30" ||
    normalized === "H1" ||
    normalized === "H4" ||
    normalized === "D1" ||
    normalized === "W1"
  ) {
    return normalized;
  }

  if (normalized === "15M") return "M15";
  if (normalized === "30M") return "M30";
  if (normalized === "1H") return "H1";
  if (normalized === "4H") return "H4";
  if (normalized === "1D") return "D1";
  if (normalized === "1W") return "W1";

  return null;
}

function normalizeAsset(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const asset = value.trim();
  return asset ? asset.toUpperCase() : null;
}

function normalizeUnitScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value >= 0 && value <= 1) {
    return value;
  }

  if (value >= 0 && value <= 100) {
    return value / 100;
  }

  return null;
}

function normalizeDrawdownPenalty(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const absoluteDrawdown = Math.abs(value);
  const capped = Math.min(absoluteDrawdown, 60);
  return 1 - capped / 60;
}

function computeCredibilityScore(doc: TraderSignalDoc): {
  score: number;
  historicalPerformance: number | null;
  riskConsistency: number | null;
  drawdown: number | null;
} {
  const explicitScore = normalizeUnitScore(
    doc.credibility_score ?? doc.credibilityScore
  );
  if (explicitScore !== null) {
    return {
      score: explicitScore,
      historicalPerformance: normalizeUnitScore(
        doc.historical_performance ?? doc.historicalPerformance
      ),
      riskConsistency: normalizeUnitScore(
        doc.risk_consistency ?? doc.riskConsistency
      ),
      drawdown: typeof (doc.max_drawdown ?? doc.maxDrawdown ?? doc.drawdown) === "number"
        ? Number(doc.max_drawdown ?? doc.maxDrawdown ?? doc.drawdown)
        : null,
    };
  }

  const historicalPerformance = normalizeUnitScore(
    doc.historical_performance ?? doc.historicalPerformance
  );
  const riskConsistency = normalizeUnitScore(
    doc.risk_consistency ?? doc.riskConsistency
  );
  const drawdownPenalty = normalizeDrawdownPenalty(
    doc.max_drawdown ?? doc.maxDrawdown ?? doc.drawdown
  );

  const hp = historicalPerformance ?? 0.5;
  const rc = riskConsistency ?? 0.5;
  const dd = drawdownPenalty ?? 0.5;

  return {
    score: Math.max(0, Math.min(1, hp * 0.5 + rc * 0.3 + dd * 0.2)),
    historicalPerformance,
    riskConsistency,
    drawdown:
      typeof (doc.max_drawdown ?? doc.maxDrawdown ?? doc.drawdown) === "number"
        ? Number(doc.max_drawdown ?? doc.maxDrawdown ?? doc.drawdown)
        : null,
  };
}

function toNormalizedSignal(id: string, raw: TraderSignalDoc): NormalizedSignal | null {
  const asset = normalizeAsset(raw.asset ?? raw.symbol);
  const direction = normalizeDirection(raw.direction ?? raw.action);
  if (!asset || !direction) {
    return null;
  }

  const timeframe = normalizeTimeframe(raw.timeframe ?? raw.time_frame);

  const traderName =
    (typeof (raw.trader_name ?? raw.traderName) === "string"
      ? String(raw.trader_name ?? raw.traderName)
      : "Unknown Trader").trim() || "Unknown Trader";
  const firmName =
    (typeof (raw.firm_name ?? raw.firmName) === "string"
      ? String(raw.firm_name ?? raw.firmName)
      : "Unknown Firm").trim() || "Unknown Firm";

  const statusRaw = String(raw.status ?? "open").toLowerCase();
  const status: "open" | "closed" = statusRaw === "closed" ? "closed" : "open";

  const entryValue = raw.entry;
  const entry =
    typeof entryValue === "number" && Number.isFinite(entryValue)
      ? entryValue
      : null;

  const openedAt = normalizeTimestamp(raw.opened_at ?? raw.openedAt);
  const closedAt = normalizeTimestamp(raw.closed_at ?? raw.closedAt);

  const reason =
    typeof (raw.reason ?? raw.source_reason ?? raw.sourceReason) === "string"
      ? String(raw.reason ?? raw.source_reason ?? raw.sourceReason).trim() || null
      : null;

  const sourceUrl =
    typeof (raw.source_url ?? raw.sourceUrl) === "string"
      ? String(raw.source_url ?? raw.sourceUrl).trim() || null
      : null;

  const score = computeCredibilityScore(raw);

  return {
    id,
    asset,
    direction,
    timeframe,
    entry,
    traderName,
    firmName,
    status,
    openedAt,
    closedAt,
    reason,
    sourceUrl,
    credibilityScore: score.score,
    metrics: {
      historicalPerformance: score.historicalPerformance,
      riskConsistency: score.riskConsistency,
      drawdown: score.drawdown,
    },
  };
}

function toConfidenceLevel(score: number): "Low" | "Medium" | "High" {
  if (score >= 0.78) {
    return "High";
  }
  if (score >= 0.58) {
    return "Medium";
  }
  return "Low";
}

function chooseChartTimeframe(signals: NormalizedSignal[]): Timeframe {
  const preferred = signals.find((signal) => signal.timeframe);
  return preferred?.timeframe ?? "H1";
}

export function getVerifiedTraderSignalsTool(ctx: ToolContext) {
  return tool({
    description:
      "Collect and group verified professional trader signals, rank by credibility and agreement, and report newly opened/closed trades. Never predicts prices.",
    inputSchema: z.object({
      assets: z.array(z.string()).max(30).optional(),
      lookbackHours: z.number().min(1).max(24 * 30).default(72),
      includeClosed: z.boolean().default(true),
      maxSignals: z.number().min(1).max(250).default(120),
    }),
    execute: async ({ assets, lookbackHours, includeClosed, maxSignals }) => {
      const now = Date.now();
      const lookbackMs = lookbackHours * 60 * 60 * 1000;
      const lookbackStart = now - lookbackMs;
      const requestedAssets = new Set(
        (assets ?? []).map((asset) => asset.trim().toUpperCase()).filter(Boolean)
      );

      const snapshot = await ctx.adminDb
        .collection((COLLECTIONS as Record<string, string>).TRADER_SIGNALS ?? "trader_signals")
        .where("user_id", "==", ctx.userId)
        .limit(maxSignals)
        .get();

      const normalizedSignals = snapshot.docs
        .map((doc) => toNormalizedSignal(doc.id, doc.data() as TraderSignalDoc))
        .filter((signal): signal is NormalizedSignal => Boolean(signal))
        .filter((signal) =>
          requestedAssets.size > 0 ? requestedAssets.has(signal.asset) : true
        )
        .filter((signal) =>
          includeClosed ? true : signal.status === "open"
        );

      if (normalizedSignals.length === 0) {
        return {
          ok: true,
          message: NO_DATA_MESSAGE,
          consensusTrades: [],
          newlyOpenedTrades: [],
          newlyClosedTrades: [],
          tracking: {
            lookbackHours,
            monitoredAssets: [...requestedAssets],
            activeSignals: 0,
          },
        };
      }

      const grouped = new Map<string, NormalizedSignal[]>();
      for (const signal of normalizedSignals) {
        if (signal.status !== "open") {
          continue;
        }

        const key = `${signal.asset}::${signal.direction}`;
        const list = grouped.get(key) ?? [];
        list.push(signal);
        grouped.set(key, list);
      }

      const consensusTrades = [...grouped.entries()]
        .map(([key, signals]) => {
          const [asset, direction] = key.split("::");
          const uniqueTraders = new Set(signals.map((signal) => signal.traderName));
          const avgCredibility =
            signals.reduce((sum, signal) => sum + signal.credibilityScore, 0) /
            Math.max(signals.length, 1);
          const agreementScore = Math.min(uniqueTraders.size / 4, 1);
          const confidenceScore = Math.max(
            0,
            Math.min(1, avgCredibility * 0.7 + agreementScore * 0.3)
          );

          const availableEntries = signals
            .map((signal) => signal.entry)
            .filter((entry): entry is number => typeof entry === "number");

          const reasons = signals
            .map((signal) => signal.reason)
            .filter((reason): reason is string => Boolean(reason))
            .slice(0, 5);

          return {
            tradeAction: direction,
            asset,
            timeframe: chooseChartTimeframe(signals),
            tradersInvolved: signals.map((signal) => ({
              trader: signal.traderName,
              firm: signal.firmName,
              credibilityScore: Number(signal.credibilityScore.toFixed(3)),
              historicalPerformance: signal.metrics.historicalPerformance,
              riskConsistency: signal.metrics.riskConsistency,
              drawdown: signal.metrics.drawdown,
              entry: signal.entry,
              sourceUrl: signal.sourceUrl,
            })),
            confidenceLevel: toConfidenceLevel(confidenceScore),
            confidenceScore: Number(confidenceScore.toFixed(3)),
            explanation:
              reasons[0] ??
              `${signals.length} verified trader signal${signals.length === 1 ? "" : "s"} aligned on ${direction} ${asset}.`,
            entryRange:
              availableEntries.length > 0
                ? {
                    min: Number(Math.min(...availableEntries).toFixed(8)),
                    max: Number(Math.max(...availableEntries).toFixed(8)),
                  }
                : null,
            agreementCount: uniqueTraders.size,
            highlightedConsensus: uniqueTraders.size >= 3 && confidenceScore >= 0.78,
          };
        })
        .sort((a, b) => b.confidenceScore - a.confidenceScore);

      const bestConsensusTrade = consensusTrades[0] ?? null;
      const bestChart = bestConsensusTrade
        ? {
            title: `${bestConsensusTrade.asset} ${bestConsensusTrade.tradeAction}`,
            subtitle: `${bestConsensusTrade.agreementCount} verified trader${bestConsensusTrade.agreementCount === 1 ? "" : "s"} aligned`,
            symbol: bestConsensusTrade.asset,
            timeframe: bestConsensusTrade.timeframe,
            action: bestConsensusTrade.tradeAction,
            confidence: bestConsensusTrade.confidenceScore,
            entry:
              bestConsensusTrade.entryRange?.min ??
              bestConsensusTrade.tradersInvolved.find((trader) => typeof trader.entry === "number")?.entry ??
              undefined,
            stopLoss: undefined,
            takeProfit: undefined,
          }
        : null;

      const newlyOpenedTrades = normalizedSignals
        .filter((signal) => signal.status === "open")
        .filter((signal) => (signal.openedAt ?? 0) >= lookbackStart)
        .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
        .map((signal) => ({
          asset: signal.asset,
          direction: signal.direction,
          entry: signal.entry,
          trader: signal.traderName,
          firm: signal.firmName,
          openedAt: signal.openedAt,
          credibilityScore: Number(signal.credibilityScore.toFixed(3)),
          sourceUrl: signal.sourceUrl,
          reason: signal.reason,
        }));

      const newlyClosedTrades = normalizedSignals
        .filter((signal) => signal.status === "closed")
        .filter((signal) => (signal.closedAt ?? 0) >= lookbackStart)
        .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
        .map((signal) => ({
          asset: signal.asset,
          direction: signal.direction,
          entry: signal.entry,
          trader: signal.traderName,
          firm: signal.firmName,
          closedAt: signal.closedAt,
          credibilityScore: Number(signal.credibilityScore.toFixed(3)),
          sourceUrl: signal.sourceUrl,
          reason: signal.reason,
        }));

      const activeSignals = normalizedSignals.filter(
        (signal) => signal.status === "open"
      ).length;

      return {
        ok: true,
        message: activeSignals > 0 ? "Verified trader signals loaded." : NO_DATA_MESSAGE,
        consensusTrades,
        bestConsensusTrade,
        bestChart,
        newlyOpenedTrades,
        newlyClosedTrades,
        tracking: {
          lookbackHours,
          monitoredAssets: [...requestedAssets],
          activeSignals,
          totalSignals: normalizedSignals.length,
          strongConsensusCount: consensusTrades.filter((item) => item.highlightedConsensus)
            .length,
        },
      };
    },
  });
}
