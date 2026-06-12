import type { Timeframe, TradingAction } from "@/types/trading";
import { normalizeTradeSignalConfidence } from "./trade-signal-confidence";

export type NormalizedTradeSignalChartConfig = {
  title?: string;
  subtitle?: string;
  symbol: string;
  timeframe: Timeframe;
  action: TradingAction;
  confidence?: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return undefined;
  }

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function normalizeTimeframe(value: unknown): Timeframe {
  if (value === "M15" || value === "M30" || value === "H1" || value === "H4" || value === "D1" || value === "W1") {
    return value;
  }

  return "H1";
}

function normalizeAction(value: unknown): TradingAction {
  if (value === "Buy" || value === "Sell" || value === "Hold") {
    return value;
  }

  return "Hold";
}

function readPositiveNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : undefined;

  return parsed !== undefined && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
}

export function normalizeTradeSignalChartConfig(
  configText: string
): NormalizedTradeSignalChartConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(configText);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const symbol = cleanText(parsed.symbol, 40)?.replace(/\s+/g, "");
  if (!symbol) {
    return null;
  }

  const title = cleanText(parsed.title, 160);
  const subtitle = cleanText(parsed.subtitle, 300);
  const confidence = normalizeTradeSignalConfidence(parsed.confidence);
  const entry = readPositiveNumber(parsed.entry);
  const stopLoss = readPositiveNumber(parsed.stopLoss);
  const takeProfit = readPositiveNumber(parsed.takeProfit);

  return {
    ...(title !== undefined ? { title } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    symbol,
    timeframe: normalizeTimeframe(parsed.timeframe),
    action: normalizeAction(parsed.action),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(entry !== undefined ? { entry } : {}),
    ...(stopLoss !== undefined ? { stopLoss } : {}),
    ...(takeProfit !== undefined ? { takeProfit } : {}),
  };
}
