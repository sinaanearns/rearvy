const RAW_TOOL_MARKER_PATTERNS = [
  /<\|tool_call_begin\|>/gi,
  /<\|tool_call_end\|>/gi,
  /<\|tool_calls_section_begin\|>/gi,
  /<\|tool_calls_section_end\|>/gi,
  /<\|im_end\|>/gi,
  /<\|im_start\|>/gi,
];

const RAW_TOOL_LINE_PATTERNS = [
  /^\s*functions\.[\w.-]+:\d+\{.*$/gim,
  /^\s*\[\{'type': 'text', 'text': .*$/gim,
  /^\s*\[\{"type":\s*"text",\s*"text":.*$/gim,
];

export function sanitizeAssistantText(text: string): string {
  let sanitized = text;

  for (const pattern of RAW_TOOL_MARKER_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  for (const pattern of RAW_TOOL_LINE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  sanitized = sanitized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return sanitized;
}
