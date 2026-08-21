import test from "node:test";
import assert from "node:assert/strict";
import { formatTokens, getUsageTone } from "./token-usage-meter";
import { formatDurationMs } from "@/lib/chat/assistant-timeline";

test("formatTokens formats token counts with appropriate suffixes", () => {
  assert.equal(formatTokens(500), "500");
  assert.equal(formatTokens(1500), "1.5K");
  assert.equal(formatTokens(22000), "22K");
  assert.equal(formatTokens(106000), "106K");
  assert.equal(formatTokens(128000), "128K");
  assert.equal(formatTokens(1000000), "1.0M");
  assert.equal(formatTokens(12500000), "13M");
});

test("getUsageTone assigns colors based on context usage thresholds", () => {
  assert.equal(getUsageTone(10), "bg-emerald-500");
  assert.equal(getUsageTone(50), "bg-emerald-500");
  assert.equal(getUsageTone(75), "bg-amber-500");
  assert.equal(getUsageTone(89), "bg-amber-500");
  assert.equal(getUsageTone(90), "bg-rose-500");
  assert.equal(getUsageTone(100), "bg-rose-500");
});

test("formatDurationMs formats turn durations accurately", () => {
  assert.equal(formatDurationMs(450), "450ms");
  assert.equal(formatDurationMs(1200), "1.2s");
  assert.equal(formatDurationMs(2000), "2s");
  assert.equal(formatDurationMs(3400), "3.4s");
  assert.equal(formatDurationMs(65000), "1m 5s");
});
