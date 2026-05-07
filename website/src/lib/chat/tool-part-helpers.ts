/**
 * Tool-part helpers used in ChatContainer to inspect AI tool call/result parts.
 * Extracted here to avoid duplication between client components and route files.
 */

import type { UIMessage } from "ai";

type AnyPart = UIMessage["parts"][number];

interface ToolLikePart {
  type: string;
  toolName?: string;
  toolCallId?: string;
  output?: unknown;
  result?: unknown;
  input?: unknown;
  args?: unknown;
}

export function isToolPart(part: AnyPart): part is AnyPart & ToolLikePart {
  const p = part as ToolLikePart;
  return (
    typeof p.type === "string" &&
    (p.type.startsWith("tool-") ||
      p.type === "dynamic-tool" ||
      typeof p.toolName === "string")
  );
}

export function resolveToolName(part: AnyPart): string {
  const p = part as ToolLikePart;
  if (typeof p.toolName === "string" && p.toolName) return p.toolName;
  if (typeof p.type === "string") return p.type.replace(/^tool-/, "");
  return "";
}

export function getToolPartPayload(part: AnyPart): unknown {
  const p = part as ToolLikePart;
  if (p.output !== undefined && p.output !== null) return p.output;
  if (p.result !== undefined && p.result !== null) return p.result;
  return null;
}

export function isBrowserToolName(toolName: string): boolean {
  return (
    toolName === "runBrowserTask" ||
    toolName === "controlBrowserSession" ||
    toolName === "runAutomationPlan"
  );
}
