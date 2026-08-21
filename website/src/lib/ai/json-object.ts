import { isRecord } from "@/lib/api/request-body";

export function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function extractFirstJsonObject(text: string) {
  return extractFirstBalancedJsonValue(text, "{", "}");
}

export function extractFirstJsonArray(text: string) {
  return extractFirstBalancedJsonValue(text, "[", "]");
}

function extractFirstBalancedJsonValue(
  text: string,
  openChar: "{" | "[",
  closeChar: "}" | "]"
) {
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (startIndex === -1) {
      if (char === openChar) {
        startIndex = index;
        depth = 1;
      }
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

export function parseJsonRecord(text: string) {
  const parsed = parseJsonValue(text);
  return isRecord(parsed) ? parsed : null;
}

export function parseJsonValue(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function parseJsonArray(text: string) {
  const parsed = parseJsonValue(text);
  return Array.isArray(parsed) ? parsed : null;
}

export function parseJsonRecordFromText(text: string) {
  const cleaned = stripJsonFence(text);
  return (
    parseJsonRecord(cleaned) ??
    (() => {
      const jsonObject = extractFirstJsonObject(cleaned);
      return jsonObject ? parseJsonRecord(jsonObject) : null;
    })()
  );
}

export function parseJsonArrayFromText(text: string) {
  const cleaned = stripJsonFence(text);
  return (
    parseJsonArray(cleaned) ??
    (() => {
      const jsonArray = extractFirstJsonArray(cleaned);
      return jsonArray ? parseJsonArray(jsonArray) : null;
    })()
  );
}
