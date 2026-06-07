import { parseJsonRecordFromText } from "@/lib/ai/json-object";

export type MariaActionPlan = {
  action: "click" | "none";
  label: string;
  reason: string;
  x?: number;
  y?: number;
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

  const action = parsed.action === "click" ? "click" : "none";
  const x = Number(parsed.x);
  const y = Number(parsed.y);
  const confidence = Number(parsed.confidence);
  const risk = coerceRisk(parsed.risk);
  const label =
    coerceShortText(parsed.label, 80) ||
    (action === "click" ? "Click visible control" : FALLBACK_ACTION_PLAN.label);
  const reason =
    coerceShortText(parsed.reason, 220) || FALLBACK_ACTION_PLAN.reason;

  if (action !== "click") {
    return {
      action: "none",
      label,
      reason,
      confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0,
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
    confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0.5,
    risk,
  };
}
