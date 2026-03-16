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
