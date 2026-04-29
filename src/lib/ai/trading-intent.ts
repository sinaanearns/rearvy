import type { Timeframe } from "@/types/trading";

const QUOTE_ASSETS = new Set([
  "USD",
  "USDT",
  "USDC",
  "EUR",
  "GBP",
  "JPY",
  "INR",
  "AUD",
  "CAD",
  "CHF",
  "NZD",
  "BTC",
  "ETH",
  "BNB",
]);

const TRADING_PAIR_PATTERN =
  /\b([a-z]{2,10})\s*[/-]\s*([a-z]{2,10})\b/i;

const TIMEFRAME_ALIASES: Array<[RegExp, Timeframe]> = [
  [/\b(?:m15|15m|15\s*min(?:ute)?s?)\b/i, "M15"],
  [/\b(?:m30|30m|30\s*min(?:ute)?s?)\b/i, "M30"],
  [/\b(?:h1|1h|1\s*hour)\b/i, "H1"],
  [/\b(?:h4|4h|4\s*hour)\b/i, "H4"],
  [/\b(?:d1|1d|daily|1\s*day)\b/i, "D1"],
  [/\b(?:w1|1w|weekly|1\s*week)\b/i, "W1"],
];

export type TradingPairIntent = {
  symbol: string;
  timeframe: Timeframe;
};

export function detectTradingPairIntent(
  userText: string | null | undefined
): TradingPairIntent | null {
  const text = userText?.trim();
  if (!text) {
    return null;
  }

  const pairMatch = text.match(TRADING_PAIR_PATTERN);
  if (!pairMatch?.[1] || !pairMatch[2]) {
    return null;
  }

  const base = pairMatch[1].toUpperCase();
  const quote = pairMatch[2].toUpperCase();
  if (!QUOTE_ASSETS.has(quote)) {
    return null;
  }

  const timeframe =
    TIMEFRAME_ALIASES.find(([pattern]) => pattern.test(text))?.[1] ?? "H1";

  return {
    symbol: `${base}/${quote}`,
    timeframe,
  };
}
