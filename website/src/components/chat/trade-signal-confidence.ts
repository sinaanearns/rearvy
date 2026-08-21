export function normalizeTradeSignalConfidence(confidence: unknown): number | undefined {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return undefined;
  }

  if (confidence >= 0 && confidence <= 1) {
    return confidence;
  }

  if (confidence > 1 && confidence <= 100) {
    return confidence / 100;
  }

  return undefined;
}

export function formatTradeSignalConfidence(confidence: unknown): string {
  const normalized = normalizeTradeSignalConfidence(confidence);
  if (normalized === undefined) {
    return "--";
  }

  return `${Math.round(normalized * 100)}%`;
}
