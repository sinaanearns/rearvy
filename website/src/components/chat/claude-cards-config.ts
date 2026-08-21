export type ClaudeCardItem = {
  label: string;
  value?: string | number;
  benchmark?: string;
  note?: string;
  delta?: string;
  tone?: "good" | "neutral" | "bad" | "accent";
  sparkline?: number[];
};

export type ClaudeCardsConfig = {
  title?: string;
  subtitle?: string;
  cards?: ClaudeCardItem[];
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

function normalizeTone(value: unknown): ClaudeCardItem["tone"] | undefined {
  if (value === "good" || value === "neutral" || value === "bad" || value === "accent") {
    return value;
  }

  return undefined;
}

function normalizeSparkline(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const points = value
    .filter((point): point is number => {
      return typeof point === "number" && Number.isFinite(point) && point >= 0;
    })
    .slice(-24);

  return points.length > 0 ? points : undefined;
}

function normalizeCard(value: unknown): ClaudeCardItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const label = cleanText(value.label, 160);
  if (!label) {
    return null;
  }

  const textValue = cleanText(value.value, 240);
  const numericValue =
    typeof value.value === "number" && Number.isFinite(value.value)
      ? value.value
      : undefined;
  const benchmark = cleanText(value.benchmark, 240);
  const note = cleanText(value.note, 1000);
  const delta = cleanText(value.delta, 120);
  const tone = normalizeTone(value.tone);
  const sparkline = normalizeSparkline(value.sparkline);

  return {
    label,
    ...(textValue !== undefined
      ? { value: textValue }
      : numericValue !== undefined
        ? { value: numericValue }
        : {}),
    ...(benchmark !== undefined ? { benchmark } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(delta !== undefined ? { delta } : {}),
    ...(tone !== undefined ? { tone } : {}),
    ...(sparkline !== undefined ? { sparkline } : {}),
  };
}

export function normalizeClaudeCardsConfig(configText: string): ClaudeCardsConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(configText);
  } catch {
    return {};
  }

  if (!isRecord(parsed)) {
    return {};
  }

  const title = cleanText(parsed.title, 160);
  const subtitle = cleanText(parsed.subtitle, 300);
  const cards = Array.isArray(parsed.cards)
    ? parsed.cards.flatMap((card) => {
        const normalized = normalizeCard(card);
        return normalized ? [normalized] : [];
      }).slice(0, 9)
    : undefined;

  return {
    ...(title !== undefined ? { title } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    ...(cards !== undefined ? { cards } : {}),
  };
}
