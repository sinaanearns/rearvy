import test from "node:test";
import assert from "node:assert/strict";

import {
  formatTradeSignalConfidence,
  normalizeTradeSignalConfidence,
} from "./trade-signal-confidence.ts";

test("normalizeTradeSignalConfidence preserves fractional confidence", () => {
  assert.equal(normalizeTradeSignalConfidence(0.72), 0.72);
  assert.equal(formatTradeSignalConfidence(0.72), "72%");
});

test("normalizeTradeSignalConfidence accepts percentage-style confidence", () => {
  assert.equal(normalizeTradeSignalConfidence(72), 0.72);
  assert.equal(formatTradeSignalConfidence(72), "72%");
});

test("normalizeTradeSignalConfidence rejects invalid confidence values", () => {
  assert.equal(normalizeTradeSignalConfidence(-1), undefined);
  assert.equal(normalizeTradeSignalConfidence(101), undefined);
  assert.equal(normalizeTradeSignalConfidence(Number.NaN), undefined);
  assert.equal(formatTradeSignalConfidence("72"), "--");
});
