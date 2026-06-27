import { parseJsonRecordFromText } from "@/lib/ai/json-object";

export type MariaActionPlan = {
  action: "click" | "type" | "scroll" | "none";
  label: string;
  reason: string;
  x?: number;
  y?: number;
  text?: string;
  enter?: boolean;
  direction?: string;
  amount?: number;
  confidence: number;
  risk: "low" | "medium" | "high";
};

const FALLBACK_ACTION_PLAN: MariaActionPlan = {
  action: "none",
  label: "No safe action",
  reason: "I could not identify one safe mouse action from the visible screen.",
  confidence: 0,
  risk: "medium",
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function coerceRisk(value: unknown): MariaActionPlan["risk"] {
  return value === "medium" || value === "high" ? value : "low";
}

function coerceShortText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function coerceMariaActionPlan(value: string): MariaActionPlan {
  const parsed = parseJsonRecordFromText(value);
  if (!parsed) {
    return FALLBACK_ACTION_PLAN;
  }

  const rawAction = String(parsed.action || "").toLowerCase();
  const action = rawAction === "click" ? "click" : rawAction === "type" ? "type" : rawAction === "scroll" ? "scroll" : "none";
  
  const x = Number(parsed.x);
  const y = Number(parsed.y);
  const confidence = Number(parsed.confidence);
  const risk = coerceRisk(parsed.risk);
  const label =
    coerceShortText(parsed.label, 80) ||
    (action === "click" ? "Click visible control" : action === "type" ? "Type into control" : action === "scroll" ? "Scroll screen" : FALLBACK_ACTION_PLAN.label);
  const reason =
    coerceShortText(parsed.reason, 220) || FALLBACK_ACTION_PLAN.reason;

  const text = parsed.text !== undefined ? coerceShortText(parsed.text, 220) : undefined;
  const enter = parsed.enter === true;
  const direction = parsed.direction !== undefined ? coerceShortText(parsed.direction, 20) : undefined;
  const amount = parsed.amount !== undefined ? Number(parsed.amount) : undefined;

  if (action === "none") {
    return {
      action: "none",
      label,
      reason,
      confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0,
      risk,
    };
  }

  if (action === "scroll") {
    return {
      action: "scroll",
      label,
      reason,
      direction,
      amount,
      confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0.8,
      risk,
    };
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      ...FALLBACK_ACTION_PLAN,
      reason: "The action plan did not include usable screen coordinates.",
    };
  }

  return {
    action,
    label,
    reason,
    x: clamp01(x),
    y: clamp01(y),
    text,
    enter,
    confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0.5,
    risk,
  };
}
