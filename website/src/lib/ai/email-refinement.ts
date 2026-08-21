import { parseJsonRecordFromText } from "@/lib/ai/json-object";

export interface RefinedEmailDraft {
  subject: string;
  body: string;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseRefinedEmailDraft(text: string): RefinedEmailDraft | null {
  const parsed = parseJsonRecordFromText(text);
  if (!parsed) {
    return null;
  }

  const body = readString(parsed.body);
  if (!body) {
    return null;
  }

  return {
    subject: readString(parsed.subject),
    body,
  };
}
