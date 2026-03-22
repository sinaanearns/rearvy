const RAW_TOOL_MARKER_PATTERNS = [
  /<\|tool_call_begin\|>/gi,
  /<\|tool_call_end\|>/gi,
  /<\|tool_calls_section_begin\|>/gi,
  /<\|tool_calls_section_end\|>/gi,
  /<\|im_end\|>/gi,
  /<\|im_start\|>/gi,
];

const RAW_TOOL_LINE_PATTERNS = [
  // functions.toolName:N{...} (single-line)
  /^\s*functions\.[\w.-]+:\d+\{.*\}?\s*$/gim,
  // functions.toolName:N followed by multi-line JSON block
  /^\s*functions\.[\w.-]+:\d+\s*\n\{[\s\S]*?\}\s*$/gim,

  // <tool_call>...</tool_call> blocks
  /<tool_call>[\s\S]*?<\/tool_call>/gi,
  // <function=toolName>{...}</function> blocks
  /<function=[\w.-]+>[\s\S]*?<\/function>/gi,
  // Standalone JSON tool call objects: {"name": "...", "arguments": ...}
  /^\s*\{"name":\s*"[\w.-]+".*"arguments":\s*\{.*\}\s*\}\s*$/gim,
];

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
          .filter(
            (p: any) =>
              p &&
              typeof p === "object" &&
              p.type === "text" &&
              typeof p.text === "string"
          )
          .map((p: any) => p.text)
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

export function sanitizeAssistantText(text: string): string {
  let sanitized = text;

  // 1. Try to unwrap raw JSON part wrappers
  sanitized = unwrapJsonPartsArray(sanitized);

  // 2. Convert literal \n sequences to real newlines
  sanitized = normalizeLiteralEscapes(sanitized);

  // 3. Strip tool markers
  for (const pattern of RAW_TOOL_MARKER_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // 4. Strip tool line patterns
  for (const pattern of RAW_TOOL_LINE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // 5. Clean up excessive whitespace
  sanitized = sanitized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return sanitized;
}
