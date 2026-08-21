export type RangeConfig = {
  min: number;
  max: number;
  step: number;
};

export type InteractiveExplainerConfig = {
  title: string;
  subtitle: string;
  principal: number;
  rate: number;
  years: number;
  principalRange: RangeConfig;
  rateRange: RangeConfig;
  yearsRange: RangeConfig;
};

export const DEFAULT_INTERACTIVE_EXPLAINER_CONFIG: InteractiveExplainerConfig = {
  title: "Interactive Financial Explainer",
  subtitle: "Adjust values to see live scenario changes",
  principal: 10000,
  rate: 7,
  years: 10,
  principalRange: { min: 1000, max: 100000, step: 500 },
  rateRange: { min: 1, max: 30, step: 0.5 },
  yearsRange: { min: 1, max: 30, step: 1 },
};

const RANGE_LIMITS = {
  principal: { min: 1, max: 10000000, stepMax: 1000000 },
  rate: { min: 0, max: 100, stepMax: 10 },
  years: { min: 1, max: 100, stepMax: 10 },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(
  value: unknown,
  fallback: RangeConfig,
  limits: { min: number; max: number; stepMax: number }
): RangeConfig {
  const record = isRecord(value) ? value : {};
  const rawMin = readNumber(record.min) ?? fallback.min;
  const rawMax = readNumber(record.max) ?? fallback.max;
  const min = clamp(Math.min(rawMin, rawMax), limits.min, limits.max);
  const max = clamp(Math.max(rawMin, rawMax), limits.min, limits.max);
  const rawStep = readNumber(record.step);
  const step =
    rawStep !== undefined && rawStep > 0
      ? clamp(rawStep, 0.0001, limits.stepMax)
      : fallback.step;

  if (min === max) {
    return {
      min,
      max: clamp(min + fallback.step, limits.min, limits.max),
      step: fallback.step,
    };
  }

  return { min, max, step };
}

function normalizeValue(value: unknown, fallback: number, range: RangeConfig) {
  return clamp(readNumber(value) ?? fallback, range.min, range.max);
}

export function normalizeInteractiveExplainerConfig(
  configText: string
): InteractiveExplainerConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(configText);
  } catch {
    parsed = {};
  }

  const record = isRecord(parsed) ? parsed : {};
  const defaults = DEFAULT_INTERACTIVE_EXPLAINER_CONFIG;
  const principalRange = normalizeRange(
    record.principalRange,
    defaults.principalRange,
    RANGE_LIMITS.principal
  );
  const rateRange = normalizeRange(
    record.rateRange,
    defaults.rateRange,
    RANGE_LIMITS.rate
  );
  const yearsRange = normalizeRange(
    record.yearsRange,
    defaults.yearsRange,
    RANGE_LIMITS.years
  );

  return {
    title: cleanText(record.title, defaults.title, 160),
    subtitle: cleanText(record.subtitle, defaults.subtitle, 300),
    principal: normalizeValue(record.principal, defaults.principal, principalRange),
    rate: normalizeValue(record.rate, defaults.rate, rateRange),
    years: normalizeValue(record.years, defaults.years, yearsRange),
    principalRange,
    rateRange,
    yearsRange,
  };
}
