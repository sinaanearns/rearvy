import { parseJsonArray, parseJsonValue } from "@/lib/ai/json-object";

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

const RAW_REASONING_BLOCK_PATTERNS = [
  /<think\b[^>]*>[\s\S]*?<\/think>/gi,
  /<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi,
  /<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi,
  /<analysis\b[^>]*>[\s\S]*?<\/analysis>/gi,
  /<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi,
];

const RAW_REASONING_OPEN_TAG_PATTERN =
  /<(?:think|thinking|reasoning|analysis)\b[^>]*>[\s\S]*$/i;
const RAW_REASONING_DANGLING_END_PATTERN =
  /^\s*[\s\S]{0,1000}?<\/(?:think|thinking|reasoning|analysis)>\s*/i;

const LATIN_LETTER_PATTERN = /\p{Script=Latin}/u;
const CYRILLIC_LETTER_PATTERN = /\p{Script=Cyrillic}/u;
const CYRILLIC_HEADING_PATTERN = /^\s*[\p{Script=Cyrillic}\s]{3,}:\s*/u;
const VISUAL_LABELING_INSTRUCTION_LEAK_PATTERN =
  /\b(?:difficult|easy|medium)\b[\s\S]{0,120}\[[A-Z]\][\s\S]{0,240}\b(?:app name|app type|provided instructions|mark app)\b/i;
const VISUAL_LABELING_FALLBACK =
  "I could not read that screen-analysis response clearly. I will treat this as a screen-reading request and start a screenshot workflow so I can tell you what is visible.";
const LEGACY_SCREENSHOT_APPROVAL_COPY_PATTERN =
  /\bI prepared a desktop screenshot workflow\. Approve it in the Desktop Workspace to capture the screen\./g;
const SCREENSHOT_AUTO_START_COPY =
  "I prepared a desktop screenshot workflow. It will run automatically in the Desktop Workspace.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Attempt to unwrap a raw JSON parts array that some models emit as text.
 * e.g. [{"type":"text","text":"Hello **world**"}] → "Hello **world**"
 * Also handles partial arrays like [{"type": "text", "text": "..."},
 */
function unwrapJsonPartsArray(text: string): string {
  const trimmed = text.trim();

  // Full JSON array: [{"type":"text","text":"..."}]
  if (trimmed.startsWith("[{") && trimmed.endsWith("}]")) {
    const parsed = parseJsonArray(trimmed);
    if (parsed) {
      const textContent = parsed
        .filter((part: unknown): part is Record<string, unknown> => {
          return isRecord(part) && part.type === "text" && typeof part.text === "string";
        })
        .map((part) => part.text as string)
        .join("\n\n");
      if (textContent) {
        return textContent;
      }
    }
  }

  // Partial match: text starts with [{"type":"text","text":" and the rest
  // is the actual content wrapped in the JSON structure
  const partialMatch = trimmed.match(
    /^\[\s*\{\s*"type"\s*:\s*"text"\s*,\s*"text"\s*:\s*"([\s\S]+?)"\s*\}[\s\S]*$/
  );
  if (partialMatch) {
    // Unescape JSON string escapes.
    const content = parseJsonValue(`"${partialMatch[1]}"`);
    if (typeof content === "string" && content.trim()) {
      return content;
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

function removeLeakedReasoning(text: string): string {
  let cleaned = text;

  for (const pattern of RAW_REASONING_BLOCK_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Some providers stream the end of a hidden reasoning block without the
  // matching opening tag in the same text part. Drop that leaked prefix.
  cleaned = cleaned.replace(RAW_REASONING_DANGLING_END_PATTERN, "");

  // During streaming, hide an unfinished reasoning block until the closing tag
  // arrives and the complete block can be removed.
  cleaned = cleaned.replace(RAW_REASONING_OPEN_TAG_PATTERN, "");

  return cleaned;
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

function isVisualLabelingInstructionLeak(text: string): boolean {
  return VISUAL_LABELING_INSTRUCTION_LEAK_PATTERN.test(text);
}

export function sanitizeAssistantText(text: unknown): string {
  let sanitized = typeof text === "string" ? text : text == null ? "" : String(text);

  // 1. Try to unwrap raw JSON part wrappers
  sanitized = unwrapJsonPartsArray(sanitized);

  // 2. Convert literal \n sequences to real newlines
  sanitized = normalizeLiteralEscapes(sanitized);

  // 2b. Strip hidden reasoning artifacts before they can render or persist.
  sanitized = removeLeakedReasoning(sanitized);

  sanitized = sanitized.replace(
    LEGACY_SCREENSHOT_APPROVAL_COPY_PATTERN,
    SCREENSHOT_AUTO_START_COPY
  );

  if (isLikelyHtmlErrorPage(sanitized)) {
    return "Browser returned an HTML error page instead of a normal text response.";
  }

  if (isVisualLabelingInstructionLeak(sanitized)) {
    return VISUAL_LABELING_FALLBACK;
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
