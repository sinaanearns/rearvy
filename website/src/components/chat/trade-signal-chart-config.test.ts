import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTradeSignalChartConfig } from "./trade-signal-chart-config.ts";

test("normalizeTradeSignalChartConfig rejects malformed config and missing symbols", () => {
  assert.equal(normalizeTradeSignalChartConfig("not json"), null);
  assert.equal(normalizeTradeSignalChartConfig("[]"), null);
  assert.equal(normalizeTradeSignalChartConfig(JSON.stringify({ symbol: "   " })), null);
});

test("normalizeTradeSignalChartConfig cleans text and defaults invalid enums", () => {
  const config = normalizeTradeSignalChartConfig(
    JSON.stringify({
      title: " BTC\nBreakout ",
      subtitle: "  Strong\tconsensus  ",
      symbol: " BTC / USD ",
      timeframe: "M5",
      action: "Long",
      confidence: 72,
    })
  );

  assert.deepEqual(config, {
    title: "BTC Breakout",
    subtitle: "Strong consensus",
    symbol: "BTC/USD",
    timeframe: "H1",
    action: "Hold",
    confidence: 0.72,
  });
});

test("normalizeTradeSignalChartConfig accepts valid chart enums and numeric price strings", () => {
  const config = normalizeTradeSignalChartConfig(
    JSON.stringify({
      symbol: "ETH-USD",
      timeframe: "H4",
      action: "Buy",
      confidence: 0.81,
      entry: "3200.5",
      stopLoss: "3000",
      takeProfit: 3600,
    })
  );

  assert.deepEqual(config, {
    symbol: "ETH-USD",
    timeframe: "H4",
    action: "Buy",
    confidence: 0.81,
    entry: 3200.5,
    stopLoss: 3000,
    takeProfit: 3600,
  });
});

test("normalizeTradeSignalChartConfig drops invalid confidence and price levels", () => {
  const config = normalizeTradeSignalChartConfig(
    JSON.stringify({
      symbol: "SOL-USD",
      action: "Sell",
      confidence: 101,
      entry: 0,
      stopLoss: Number.NaN,
      takeProfit: "not a number",
    })
  );

  assert.deepEqual(config, {
    symbol: "SOL-USD",
    timeframe: "H1",
    action: "Sell",
  });
});
