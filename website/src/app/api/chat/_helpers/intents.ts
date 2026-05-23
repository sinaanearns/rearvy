import { formatTradingPrice } from "@/lib/trading/price-format";
import type { TradingOpinion } from "@/types/trading";
import { isRecord } from "./types";

function isTradingOpinionOutput(output: unknown): output is TradingOpinion {
  if (!isRecord(output)) {
    return false;
  }

  return (
    typeof output.action === "string" &&
    ["Buy", "Sell", "Hold"].includes(output.action) &&
    typeof output.confidence === "number" &&
    typeof output.reason === "string" &&
    typeof output.symbol === "string" &&
    typeof output.timeframe === "string" &&
    typeof output.riskNotes === "string" &&
    typeof output.fetchedAt === "number"
  );
}

export function buildTradingOpinionSummary(output: unknown) {
  if (!isTradingOpinionOutput(output)) {
    return "I checked the trading setup, but the result was not in a displayable format. Please try again.";
  }

  const confidence =
    output.action === "Hold" || output.confidence <= 0
      ? "no actionable signal"
      : `${Math.round(output.confidence * 100)}% signal agreement`;
  const heading = `${output.symbol} ${output.timeframe}: ${output.action}`;

  if (output.action === "Hold") {
    return `${heading}. There is no clean trade right now (${confidence}). ${output.reason}`;
  }

  const levels = [
    typeof output.entry === "number"
      ? `entry ${formatTradingPrice(output.entry, output.symbol)}`
      : null,
    typeof output.stopLoss === "number"
      ? `stop ${formatTradingPrice(output.stopLoss, output.symbol)}`
      : null,
    typeof output.takeProfit === "number"
      ? `target ${formatTradingPrice(output.takeProfit, output.symbol)}`
      : null,
  ].filter(Boolean);

  return `${heading} with ${confidence}.${levels.length ? ` Levels: ${levels.join(", ")}.` : ""} ${output.reason} Risk: ${output.riskNotes}`;
}

export function isVerifiedTraderSignalRequest(userText: string | null | undefined) {
  if (!userText) {
    return false;
  }

  return (
    /^\/signals\b/i.test(userText.trim()) ||
    /\b(verified trader|professional trader|trader signals?|copy signals?|hedge funds?|who is buying|who is selling)\b/i.test(
      userText
    )
  );
}

export function isBlenderIntent(userText: string | null | undefined) {
  if (!userText) {
    return false;
  }

  return /\b(blender|bpy\.|3d|sphere|cube|mesh|scene|render|uv sphere|object mode)\b/i.test(
    userText
  );
}
