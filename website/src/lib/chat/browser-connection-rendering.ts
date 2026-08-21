export type BrowserConnectionMethod =
  | "cdp-direct"
  | "extension-relay"
  | "managed-runner"
  | "firecrawl";

export type BrowserConnectionCardDisplay = "full" | "compact" | "hidden";

const BROWSER_CONNECTION_TOOL_NAME = "requestBrowserConnection";
const BROWSER_AUTOMATION_TOOL_NAMES = new Set([
  "runBrowserTask",
  "controlBrowserSession",
  "stopBrowserSession",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function normalizeBrowserConnectionMethod(
  value: unknown
): BrowserConnectionMethod | null {
  if (
    value === "cdp-direct" ||
    value === "extension-relay" ||
    value === "managed-runner" ||
    value === "firecrawl"
  ) {
    return value;
  }

  return null;
}

export function getBrowserConnectionOutputStatus(output: unknown) {
  const record = asRecord(output);
  const status = firstString(record?.status);
  if (status === "connected" || status === "skipped" || status === "failed") {
    return status;
  }

  return null;
}

export function resolveBrowserConnectionMethod(
  input: unknown,
  output?: unknown
): BrowserConnectionMethod {
  const inputRecord = asRecord(input) ?? {};
  const outputRecord = asRecord(output) ?? {};

  return (
    normalizeBrowserConnectionMethod(outputRecord.method) ??
    normalizeBrowserConnectionMethod(inputRecord.preferredMethod) ??
    "cdp-direct"
  );
}

function resolveToolName(part: unknown) {
  const record = asRecord(part);
  if (!record) {
    return null;
  }

  if (typeof record.toolName === "string" && record.toolName.trim()) {
    return record.toolName.trim();
  }

  if (typeof record.type === "string" && record.type.startsWith("tool-")) {
    return record.type.replace("tool-", "");
  }

  return null;
}

function getToolPartPayload(part: unknown) {
  const record = asRecord(part);
  if (!record) {
    return null;
  }

  if (record.output !== undefined && record.output !== null) {
    return record.output;
  }

  if (record.result !== undefined && record.result !== null) {
    return record.result;
  }

  return null;
}

function hasLaterBrowserAutomationTool(parts: unknown[], index: number) {
  for (let i = index + 1; i < parts.length; i += 1) {
    const toolName = resolveToolName(parts[i]);
    if (toolName && BROWSER_AUTOMATION_TOOL_NAMES.has(toolName)) {
      return true;
    }
  }

  return false;
}

export function getBrowserConnectionCardDisplay(
  parts: unknown[],
  index: number
): BrowserConnectionCardDisplay {
  const toolName = resolveToolName(parts[index]);
  if (toolName !== BROWSER_CONNECTION_TOOL_NAME) {
    return "full";
  }

  const outputStatus = getBrowserConnectionOutputStatus(
    getToolPartPayload(parts[index])
  );
  if (!outputStatus) {
    return "full";
  }

  return hasLaterBrowserAutomationTool(parts, index) ? "hidden" : "compact";
}
