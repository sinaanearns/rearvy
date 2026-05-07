import assert from "node:assert/strict";
import test from "node:test";
import {
  computeWhisperNetForecast,
  detectMentionInContent,
  type WhisperNetContentInput,
} from "./core.ts";

const baseWatcher = {
  product_title: "Rearvy Booster",
  aliases: ["Booster", "Rearvy Boost"],
  required_keywords: [] as string[],
  excluded_phrases: [] as string[],
  fuzzy_match: true,
};

const baseContent: WhisperNetContentInput = {
  contentItemId: "content_1",
  platform: "youtube",
  sourceId: "video_1",
  sourceUrl: "https://youtube.com/watch?v=video_1",
  creatorName: "Creator",
  publishedAt: "2026-03-21T10:00:00.000Z",
  title: "We tested Rearvy Booster live",
  description: "This launch walkthrough covers the product setup.",
  transcriptText: null,
  transcriptStatus: "unavailable",
  metrics: {
    views: 1200,
    likes: 140,
    comments: 18,
  },
};

test("detects exact product mentions in synced content", () => {
  const detection = detectMentionInContent(baseWatcher, baseContent);

  assert.ok(detection);
  assert.equal(detection?.detectionSource, "title");
  assert.equal(detection?.fuzzyMatch, false);
  assert.match(detection?.contextWindow || "", /Rearvy Booster/i);
});

test("supports fuzzy alias matches for slight creator misspellings", () => {
  const detection = detectMentionInContent(baseWatcher, {
    ...baseContent,
    title: "Why Rearvy Boostr is selling out",
  });

  assert.ok(detection);
  assert.equal(detection?.fuzzyMatch, true);
  assert.equal(detection?.matchedPhrase, "Rearvy Booster");
});

test("required keywords and excluded phrases gate detections safely", () => {
  const gatedWatcher = {
    ...baseWatcher,
    required_keywords: ["launch"],
    excluded_phrases: ["not sponsored"],
  };

  const blocked = detectMentionInContent(gatedWatcher, {
    ...baseContent,
    description: "launch recap with Rearvy Booster, not sponsored",
  });
  assert.equal(blocked, null);

  const allowed = detectMentionInContent(gatedWatcher, {
    ...baseContent,
    description: "launch recap with Rearvy Booster and customer results",
  });
  assert.ok(allowed);
});

test("forecast falls back gracefully when product sales history is sparse", () => {
  const detection = detectMentionInContent(baseWatcher, baseContent);
  assert.ok(detection);

  const forecast = computeWhisperNetForecast({
    detection: detection!,
    content: baseContent,
    product: {
      id: "product_1",
      title: "Rearvy Booster",
      price: 49,
      inventory_quantity: 80,
    },
    watcher: {
      aliases: baseWatcher.aliases,
      required_keywords: [],
      fuzzy_match: true,
      low_inventory_threshold: 10,
    },
    salesSignals: {
      unitsLast7d: 0,
      unitsLast30d: 0,
      revenueLast7d: 0,
      revenueLast30d: 0,
    },
  });

  assert.ok(forecast.predictedIncrementalUnits48h > 0);
  assert.equal(forecast.baselineUnits48h, 0);
  assert.ok(forecast.predictedIncrementalRevenue48h > 0);
});

test("forecast escalates stockout risk when demand outruns low inventory", () => {
  const highSignalContent = {
    ...baseContent,
    title: "Rearvy Booster is exploding after today's drop",
    metrics: {
      views: 180000,
      likes: 12400,
      comments: 950,
    },
  };
  const detection = detectMentionInContent(baseWatcher, highSignalContent);
  assert.ok(detection);

  const forecast = computeWhisperNetForecast({
    detection: detection!,
    content: highSignalContent,
    product: {
      id: "product_1",
      title: "Rearvy Booster",
      price: 49,
      inventory_quantity: 5,
    },
    watcher: {
      aliases: baseWatcher.aliases,
      required_keywords: [],
      fuzzy_match: true,
      low_inventory_threshold: 8,
    },
    salesSignals: {
      unitsLast7d: 14,
      unitsLast30d: 42,
      revenueLast7d: 686,
      revenueLast30d: 2058,
    },
  });

  assert.equal(forecast.stockoutRisk, "critical");
  assert.ok(
    forecast.estimatedHoursUntilStockout !== null &&
      forecast.estimatedHoursUntilStockout <= 48
  );
});
