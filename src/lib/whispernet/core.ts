import type { Product, WhisperNetWatcher } from "@/types/database";

export type WhisperNetTextSource =
  | "title"
  | "description"
  | "caption"
  | "transcript"
  | "comment";

export type WhisperNetContentInput = {
  contentItemId: string;
  platform: "youtube" | "instagram";
  sourceId: string;
  sourceUrl: string | null;
  creatorName: string | null;
  publishedAt: string | null;
  title?: string | null;
  description?: string | null;
  caption?: string | null;
  transcriptText?: string | null;
  transcriptStatus?: "available" | "pending" | "unavailable";
  metrics: {
    views?: number | null;
    impressions?: number | null;
    reach?: number | null;
    likes?: number | null;
    comments?: number | null;
  };
};

export type WhisperNetDetection = {
  detectionSource: WhisperNetTextSource;
  matchedPhrase: string;
  matchedText: string;
  contextWindow: string;
  mentionTimestampSeconds: number | null;
  confidence: number;
  fuzzyMatch: boolean;
  reasons: string[];
};

export type WhisperNetSalesSignals = {
  unitsLast7d: number;
  unitsLast30d: number;
  revenueLast7d: number;
  revenueLast30d: number;
};

export type WhisperNetForecastInput = {
  detection: WhisperNetDetection;
  content: WhisperNetContentInput;
  product: Pick<Product, "id" | "title" | "price" | "inventory_quantity">;
  watcher: Pick<
    WhisperNetWatcher,
    "low_inventory_threshold" | "aliases" | "required_keywords" | "fuzzy_match"
  >;
  salesSignals: WhisperNetSalesSignals;
};

export type WhisperNetForecastResult = {
  predictedIncrementalUnits48h: number;
  predictedIncrementalRevenue48h: number;
  baselineUnits48h: number;
  projectedTotalUnits48h: number;
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  confidenceBand: {
    lowerUnits: number;
    upperUnits: number;
    lowerRevenue: number;
    upperRevenue: number;
  };
  stockoutRisk: "low" | "medium" | "high" | "critical";
  estimatedHoursUntilStockout: number | null;
  rationale: string[];
};

const SOURCE_WEIGHTS: Record<WhisperNetTextSource, number> = {
  title: 0.92,
  description: 0.76,
  caption: 0.86,
  transcript: 0.98,
  comment: 0.66,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeWhisperText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseListInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshtein(left: string, right: string) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function scoreTokenSimilarity(left: string, right: string) {
  if (left === right) return 1;
  const distance = levenshtein(left, right);
  const maxLength = Math.max(left.length, right.length, 1);
  return 1 - distance / maxLength;
}

function findExactPhrase(rawText: string, phrase: string) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeForRegex(phrase)}([^a-z0-9]|$)`, "i");
  const match = rawText.match(pattern);
  if (!match || typeof match.index !== "number") {
    return null;
  }

  return {
    index: match.index,
    matchedText: match[0].trim(),
  };
}

function findFuzzyPhrase(rawText: string, phrase: string) {
  const normalizedPhrase = normalizeWhisperText(phrase);
  const phraseTokens = normalizedPhrase.split(" ").filter(Boolean);
  const normalizedText = normalizeWhisperText(rawText);
  const textTokens = normalizedText.split(" ").filter(Boolean);

  if (phraseTokens.length === 0 || textTokens.length < phraseTokens.length) {
    return null;
  }

  let bestCandidate:
    | { matchedText: string; confidence: number; firstToken: string }
    | null = null;

  for (let start = 0; start <= textTokens.length - phraseTokens.length; start += 1) {
    const windowTokens = textTokens.slice(start, start + phraseTokens.length);
    const similarities = windowTokens.map((token, index) =>
      scoreTokenSimilarity(token, phraseTokens[index])
    );

    const average = similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
    const allStrongEnough = similarities.every((value) => value >= 0.72);

    if (!allStrongEnough) {
      continue;
    }

    if (!bestCandidate || average > bestCandidate.confidence) {
      bestCandidate = {
        matchedText: windowTokens.join(" "),
        confidence: average,
        firstToken: windowTokens[0],
      };
    }
  }

  if (!bestCandidate) {
    return null;
  }

  const rawIndex = rawText.toLowerCase().indexOf(bestCandidate.firstToken.toLowerCase());

  return {
    index: rawIndex >= 0 ? rawIndex : 0,
    matchedText: bestCandidate.matchedText,
    confidence: bestCandidate.confidence,
  };
}

function buildContextWindow(rawText: string, index: number, length: number) {
  const start = Math.max(0, index - 72);
  const end = Math.min(rawText.length, index + length + 72);
  return rawText.slice(start, end).trim();
}

function getRequiredKeywordsPass(combinedText: string, keywords: string[]) {
  if (keywords.length === 0) {
    return true;
  }

  return keywords.every((keyword) =>
    combinedText.includes(normalizeWhisperText(keyword))
  );
}

function getExcludedPhraseHit(combinedText: string, excludedPhrases: string[]) {
  return excludedPhrases.find((phrase) =>
    combinedText.includes(normalizeWhisperText(phrase))
  );
}

export function detectMentionInContent(
  watcher: Pick<
    WhisperNetWatcher,
    | "product_title"
    | "aliases"
    | "required_keywords"
    | "excluded_phrases"
    | "fuzzy_match"
  >,
  content: WhisperNetContentInput
): WhisperNetDetection | null {
  const phrases = Array.from(
    new Set([watcher.product_title, ...(watcher.aliases || [])].map((phrase) => phrase.trim()).filter(Boolean))
  );

  if (phrases.length === 0) {
    return null;
  }

  const sources: Array<{ type: WhisperNetTextSource; value: string }> = [
    { type: "title", value: content.title || "" },
    { type: "description", value: content.description || "" },
    { type: "caption", value: content.caption || "" },
    { type: "transcript", value: content.transcriptText || "" },
  ].filter((source) => source.value.trim().length > 0);

  const combinedNormalizedText = normalizeWhisperText(
    sources.map((source) => source.value).join(" ")
  );

  if (
    !getRequiredKeywordsPass(
      combinedNormalizedText,
      watcher.required_keywords || []
    )
  ) {
    return null;
  }

  const excludedHit = getExcludedPhraseHit(
    combinedNormalizedText,
    watcher.excluded_phrases || []
  );

  if (excludedHit) {
    return null;
  }

  for (const source of sources) {
    for (const phrase of phrases) {
      const exactMatch = findExactPhrase(source.value, phrase);
      if (exactMatch) {
        const sourceWeight = SOURCE_WEIGHTS[source.type];
        return {
          detectionSource: source.type,
          matchedPhrase: phrase,
          matchedText: exactMatch.matchedText,
          contextWindow: buildContextWindow(
            source.value,
            exactMatch.index,
            exactMatch.matchedText.length
          ),
          mentionTimestampSeconds: null,
          confidence: clamp(sourceWeight + 0.02 * Math.min(phrases.length, 3), 0, 0.99),
          fuzzyMatch: false,
          reasons: [
            `${source.type} contained an exact product mention`,
            watcher.required_keywords.length > 0
              ? "required context keywords matched"
              : "no extra context gating was needed",
          ],
        };
      }

      if (!watcher.fuzzy_match) {
        continue;
      }

      const fuzzyMatch = findFuzzyPhrase(source.value, phrase);
      if (fuzzyMatch) {
        const sourceWeight = SOURCE_WEIGHTS[source.type];
        return {
          detectionSource: source.type,
          matchedPhrase: phrase,
          matchedText: fuzzyMatch.matchedText,
          contextWindow: buildContextWindow(
            source.value,
            fuzzyMatch.index,
            fuzzyMatch.matchedText.length
          ),
          mentionTimestampSeconds: null,
          confidence: clamp(sourceWeight * 0.82 + fuzzyMatch.confidence * 0.12, 0, 0.92),
          fuzzyMatch: true,
          reasons: [
            `${source.type} matched a fuzzy alias variant`,
            "useful when creators shorten or slightly misspell product names",
          ],
        };
      }
    }
  }

  return null;
}

function getEngagementVolume(metrics: WhisperNetContentInput["metrics"]) {
  const reachBase = Math.max(
    Number(metrics.views || 0),
    Number(metrics.reach || 0),
    Number(metrics.impressions || 0)
  );

  return (
    reachBase +
    Number(metrics.likes || 0) * 8 +
    Number(metrics.comments || 0) * 14
  );
}

function getConfidenceLabel(score: number): "low" | "medium" | "high" {
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

export function computeWhisperNetForecast(
  input: WhisperNetForecastInput
): WhisperNetForecastResult {
  const engagementVolume = getEngagementVolume(input.content.metrics);
  const engagementScore = clamp(Math.log10(engagementVolume + 1) / 4.2, 0, 1.2);
  const baselineFrom7d = input.salesSignals.unitsLast7d > 0
    ? (input.salesSignals.unitsLast7d / 7) * 2
    : 0;
  const baselineFrom30d = input.salesSignals.unitsLast30d > 0
    ? (input.salesSignals.unitsLast30d / 30) * 2
    : 0;
  const baselineUnits48h = round(
    baselineFrom7d > 0
      ? baselineFrom7d * 0.7 + baselineFrom30d * 0.3
      : baselineFrom30d,
    2
  );

  const mentionLiftFactor =
    0.2 +
    input.detection.confidence * 0.9 +
    engagementScore * 0.45 +
    (input.detection.fuzzyMatch ? -0.08 : 0.06);

  const sparseFallbackUnits = Math.max(
    input.detection.confidence >= 0.8 ? 1 : 0.5,
    round(engagementScore * 2.4, 2)
  );

  const predictedIncrementalUnits48h = round(
    baselineUnits48h > 0
      ? Math.max(baselineUnits48h * mentionLiftFactor, sparseFallbackUnits)
      : sparseFallbackUnits,
    2
  );

  const productPrice = Number(input.product.price || 0);
  const predictedIncrementalRevenue48h = round(
    predictedIncrementalUnits48h * productPrice,
    2
  );

  const confidenceScore = clamp(
    0.22 +
      input.detection.confidence * 0.42 +
      (input.salesSignals.unitsLast7d > 0 ? 0.14 : 0) +
      (input.salesSignals.unitsLast30d > 0 ? 0.08 : 0) +
      (engagementVolume > 0 ? 0.08 : 0) -
      (input.detection.fuzzyMatch ? 0.07 : 0),
    0.18,
    0.94
  );

  const confidenceLabel = getConfidenceLabel(confidenceScore);
  const bandSpread = clamp(0.58 - confidenceScore * 0.36, 0.18, 0.48);
  const lowerUnits = round(predictedIncrementalUnits48h * (1 - bandSpread), 2);
  const upperUnits = round(predictedIncrementalUnits48h * (1 + bandSpread), 2);
  const projectedTotalUnits48h = round(
    baselineUnits48h + predictedIncrementalUnits48h,
    2
  );

  const inventoryAvailable =
    typeof input.product.inventory_quantity === "number"
      ? input.product.inventory_quantity
      : null;
  const unitsPerHour = projectedTotalUnits48h / 48;
  const estimatedHoursUntilStockout =
    inventoryAvailable !== null && unitsPerHour > 0
      ? round(inventoryAvailable / unitsPerHour, 1)
      : null;

  let stockoutRisk: "low" | "medium" | "high" | "critical" = "low";
  if (inventoryAvailable !== null) {
    if (
      inventoryAvailable <= Math.max(input.watcher.low_inventory_threshold, projectedTotalUnits48h) ||
      (estimatedHoursUntilStockout !== null && estimatedHoursUntilStockout <= 24)
    ) {
      stockoutRisk = "critical";
    } else if (
      inventoryAvailable <=
        Math.max(input.watcher.low_inventory_threshold * 1.25, projectedTotalUnits48h * 1.2) ||
      (estimatedHoursUntilStockout !== null && estimatedHoursUntilStockout <= 48)
    ) {
      stockoutRisk = "high";
    } else if (inventoryAvailable <= input.watcher.low_inventory_threshold * 1.6) {
      stockoutRisk = "medium";
    }
  }

  const rationale = [
    `Detection confidence ${Math.round(input.detection.confidence * 100)}% from ${input.detection.detectionSource}.`,
    input.salesSignals.unitsLast7d > 0
      ? `Product sold ${round(input.salesSignals.unitsLast7d, 0)} units in the last 7 days.`
      : "Product has limited recent sales history, so the forecast uses a sparse-data fallback.",
    engagementVolume > 0
      ? `Content engagement signal is ${round(engagementScore * 100, 0)} / 100 based on reach, likes, and comments.`
      : "Content engagement data is limited, reducing forecast confidence.",
  ];

  if (inventoryAvailable !== null) {
    rationale.push(
      `Inventory on hand is ${inventoryAvailable} units with a low-stock threshold of ${input.watcher.low_inventory_threshold}.`
    );
  } else {
    rationale.push("Inventory quantity is unavailable, so stockout timing may be understated.");
  }

  return {
    predictedIncrementalUnits48h,
    predictedIncrementalRevenue48h,
    baselineUnits48h,
    projectedTotalUnits48h,
    confidence: confidenceLabel,
    confidenceScore: round(confidenceScore, 2),
    confidenceBand: {
      lowerUnits,
      upperUnits,
      lowerRevenue: round(lowerUnits * productPrice, 2),
      upperRevenue: round(upperUnits * productPrice, 2),
    },
    stockoutRisk,
    estimatedHoursUntilStockout,
    rationale,
  };
}

export function getAlertSeverityFromRisk(
  risk: WhisperNetForecastResult["stockoutRisk"]
) {
  if (risk === "critical") return "critical";
  if (risk === "high") return "warning";
  if (risk === "medium") return "info";
  return null;
}
