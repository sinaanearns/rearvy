const RAW_TOOL_MARKER_PATTERNS = [
  /<\|tool_call_begin\|>/gi,
  /<\|tool_call_end\|>/gi,
  /<\|tool_calls_section_begin\|>/gi,
  /<\|tool_calls_section_end\|>/gi,
  /<\|im_end\|>/gi,
  /<\|im_start\|>/gi,
];

const RAW_TOOL_LINE_PATTERNS = [
  // functions.toolName:N{...} (single-line or embedded inline)
  /functions\.[\w.-]+:\d+\s*\{[\s\S]*?\}/gim,
  // functions.toolName:N followed by a raw JSON block on the next line
  /functions\.[\w.-]+:\d+\s*\n\{[\s\S]*?\}/gim,
  // Bare functions.toolName:N markers with no payload
  /functions\.[\w.-]+:\d+/gim,

  // <tool_call>...</tool_call> blocks
  /<tool_call>[\s\S]*?<\/tool_call>/gi,
  // <function=toolName>{...}</function> blocks
  /<function=[\w.-]+>[\s\S]*?<\/function>/gi,
  // Standalone JSON tool call objects: {"name": "...", "arguments": ...}
  /^\s*\{"name":\s*"[\w.-]+".*"arguments":\s*\{.*\}\s*\}\s*$/gim,
];

const LATIN_LETTER_PATTERN = /\p{Script=Latin}/u;
const CYRILLIC_LETTER_PATTERN = /\p{Script=Cyrillic}/u;
const CYRILLIC_HEADING_PATTERN = /^\s*[\p{Script=Cyrillic}\s]{3,}:\s*/u;

/**
 * Attempt to unwrap a raw JSON parts array that some models emit as text.
 * e.g. [{"type":"text","text":"Hello **world**"}] → "Hello **world**"
 * Also handles partial arrays like [{"type": "text", "text": "..."},
 */
function unwrapJsonPartsArray(text: string): string {
  const trimmed = text.trim();

  // Full JSON array: [{"type":"text","text":"..."}]
  if (trimmed.startsWith("[{") && trimmed.endsWith("}]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const textContent = parsed
          .filter((part: unknown) => {
            if (!part || typeof part !== "object") {
              return false;
            }

            const record = part as Record<string, unknown>;
            return record.type === "text" && typeof record.text === "string";
          })
          .map((part: unknown) => (part as Record<string, unknown>).text as string)
          .join("\n\n");
        if (textContent) {
          return textContent;
        }
      }
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Partial match: text starts with [{"type":"text","text":" and the rest
  // is the actual content wrapped in the JSON structure
  const partialMatch = trimmed.match(
    /^\[\s*\{\s*"type"\s*:\s*"text"\s*,\s*"text"\s*:\s*"([\s\S]+?)"\s*\}[\s\S]*$/
  );
  if (partialMatch) {
    try {
      // Unescape JSON string escapes
      const content = JSON.parse(`"${partialMatch[1]}"`);
      if (typeof content === "string" && content.trim()) {
        return content;
      }
    } catch {
      // Not valid, fall through
    }
  }

  return text;
}

/**
 * Convert literal two-character escape sequences (\n, \t) that models
 * sometimes emit as text into real whitespace characters.
 */
function normalizeLiteralEscapes(text: string): string {
  // Replace literal \n (two chars: backslash + n) with actual newlines
  // Be careful not to replace already-real newlines or \\n (escaped backslash)
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

function isLikelyHtmlErrorPage(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < 200) {
    return false;
  }

  const hasHtmlWrapper = /<!doctype html>|<html\b/i.test(normalized);
  if (!hasHtmlWrapper) {
    return false;
  }

  return (
    /__next_error__|next-error|This page couldn.?t load|A server error occurred/i.test(
      normalized
    ) || /<body\b/i.test(normalized)
  );
}

/**
 * Remove likely accidental mixed-language heading lines (for example, one
 * Cyrillic heading inside an otherwise Latin response).
 */
function removeMixedScriptOutlierLine(text: string): string {
  const lines = text.split("\n");
  if (lines.length < 2) {
    return text;
  }

  const latinLineCount = lines.filter((line) => LATIN_LETTER_PATTERN.test(line)).length;
  if (latinLineCount < 2) {
    return text;
  }

  const cyrillicLineIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => CYRILLIC_LETTER_PATTERN.test(line))
    .map(({ index }) => index);

  if (cyrillicLineIndexes.length !== 1) {
    return text;
  }

  const outlierIndex = cyrillicLineIndexes[0];
  if (!CYRILLIC_HEADING_PATTERN.test(lines[outlierIndex])) {
    return text;
  }

  lines.splice(outlierIndex, 1);
  return lines.join("\n");
}

export function sanitizeAssistantText(text: string): string {
  let sanitized = text;

  // 1. Try to unwrap raw JSON part wrappers
  sanitized = unwrapJsonPartsArray(sanitized);

  // 2. Convert literal \n sequences to real newlines
  sanitized = normalizeLiteralEscapes(sanitized);

  if (isLikelyHtmlErrorPage(sanitized)) {
    return "Browser returned an HTML error page instead of a normal text response.";
  }

  // 3. Strip tool markers
  for (const pattern of RAW_TOOL_MARKER_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // 4. Strip tool line patterns
  for (const pattern of RAW_TOOL_LINE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // 4b. Remove any leftover inline tool-call artifacts that may have been
  // spliced into assistant prose instead of emitted as a standalone line.
  sanitized = sanitized.replace(/\bfunctions\.[\w.-]+:\d+\b/gim, "");

  // 4c. Remove accidental mixed-script heading artifacts.
  sanitized = removeMixedScriptOutlierLine(sanitized);

  // 5. Clean up excessive whitespace
  sanitized = sanitized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return sanitized;
}
