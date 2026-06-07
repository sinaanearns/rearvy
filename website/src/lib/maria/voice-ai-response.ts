import {
  parseJsonRecordFromText,
  stripJsonFence,
} from "@/lib/ai/json-object";

export function parseMariaVoiceAiText(value: string) {
  const cleaned = stripJsonFence(value);
  const parsed = parseJsonRecordFromText(cleaned);

  if (parsed) {
    return typeof parsed.text === "string" ? parsed.text.trim() : "";
  }

  return cleaned.trim();
}
