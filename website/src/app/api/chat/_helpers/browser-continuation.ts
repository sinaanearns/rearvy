import {
  normalizeRequestBrowserConnectionInput,
  normalizeRequestBrowserConnectionOutput,
} from "@/lib/ai/tools/browser-connection";
import {
  type IncomingMessage,
  isRecord,
} from "./types";

const BROWSER_CONNECTION_TOOL_NAME = "requestBrowserConnection";
const BROWSER_AUTOMATION_TOOL_NAMES = new Set([
  "runBrowserTask",
  "controlBrowserSession",
  "stopBrowserSession",
]);

export type BrowserConnectionOutputInfo = {
  input: Record<string, unknown> | null;
  output: Record<string, unknown>;
  toolCallId: string | null;
  messageIndex: number;
  partIndex: number;
};

export type BrowserConnectionMessageInfo = {
  input: Record<string, unknown> | null;
  output: Record<string, unknown>;
  toolCallId: string | null;
};

export function resolveToolNameFromPart(part: unknown) {
  if (!isRecord(part)) {
    return "";
  }

  if (typeof part.toolName === "string" && part.toolName.trim()) {
    return part.toolName.trim();
  }

  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.replace("tool-", "");
  }

  return "";
}

function normalizeBrowserConnectionOutput(output: unknown) {
  try {
    return normalizeRequestBrowserConnectionOutput(output);
  } catch {
    return {
      status: "failed",
      message: "Browser connection returned an invalid response.",
    };
  }
}

function normalizeLegacyBrowserConnectionText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 1000);
}

function normalizeBrowserConnectionInput(input: unknown) {
  try {
    return normalizeRequestBrowserConnectionInput(input);
  } catch {
    const record = isRecord(input) ? input : null;
    const task = normalizeLegacyBrowserConnectionText(record?.requestedAction);
    return task ? { task } : null;
  }
}

function getToolOutputFromPart(part: unknown) {
  if (!isRecord(part)) {
    return null;
  }

  const toolName = resolveToolNameFromPart(part);
  const output =
    isRecord(part.output)
      ? part.output
      : isRecord(part.result)
        ? part.result
        : null;

  if (!output) {
    return null;
  }

  return toolName === BROWSER_CONNECTION_TOOL_NAME
    ? normalizeBrowserConnectionOutput(output)
    : output;
}

function getToolInputFromPart(part: unknown) {
  if (!isRecord(part)) {
    return null;
  }

  const toolName = resolveToolNameFromPart(part);
  const input = isRecord(part.input)
    ? part.input
    : isRecord(part.args)
      ? part.args
      : null;

  if (!input) {
    return null;
  }

  return toolName === BROWSER_CONNECTION_TOOL_NAME
    ? normalizeBrowserConnectionInput(input)
    : input;
}

export function findLatestBrowserConnectionOutputInfo(
  messages: IncomingMessage[]
): BrowserConnectionOutputInfo | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (!isRecord(part)) {
        continue;
      }

      if (resolveToolNameFromPart(part) !== BROWSER_CONNECTION_TOOL_NAME) {
        continue;
      }

      const output = getToolOutputFromPart(part);
      if (output) {
        return {
          input: getToolInputFromPart(part),
          output,
          toolCallId:
            typeof part.toolCallId === "string" ? part.toolCallId : null,
          messageIndex: i,
          partIndex,
        };
      }
    }
  }

  return null;
}

export function findBrowserConnectionOutputInfoInMessage(
  message: IncomingMessage | null
): BrowserConnectionMessageInfo | null {
  if (!message || message.role !== "assistant") {
    return null;
  }

  const parts = Array.isArray(message.parts) ? message.parts : [];
  for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
    const part = parts[partIndex];
    if (!isRecord(part)) {
      continue;
    }

    if (resolveToolNameFromPart(part) !== BROWSER_CONNECTION_TOOL_NAME) {
      continue;
    }

    const output = getToolOutputFromPart(part);
    if (output) {
      return {
        input: getToolInputFromPart(part),
        output,
        toolCallId:
          typeof part.toolCallId === "string" ? part.toolCallId : null,
      };
    }
  }

  return null;
}

export function hasBrowserAutomationAfterPosition(
  messages: IncomingMessage[],
  messageIndex: number,
  partIndex: number
) {
  for (let i = messageIndex; i < messages.length; i += 1) {
    const message = messages[i];
    const parts: unknown[] = Array.isArray(message?.parts) ? message.parts : [];
    const startPartIndex = i === messageIndex ? partIndex + 1 : 0;

    for (let j = startPartIndex; j < parts.length; j += 1) {
      const toolName = resolveToolNameFromPart(parts[j]);
      if (BROWSER_AUTOMATION_TOOL_NAMES.has(toolName)) {
        return true;
      }
    }
  }

  return false;
}

export function hasBrowserTaskForConnection(
  messages: IncomingMessage[],
  connectionToolCallId: string | null
) {
  if (!connectionToolCallId) {
    return false;
  }

  for (const message of messages) {
    const messageRecord = message as IncomingMessage & Record<string, unknown>;
    const metadata = isRecord(messageRecord.metadata)
      ? messageRecord.metadata
      : null;
    if (metadata) {
      const metadataConnectionId = metadata.browserConnectionToolCallId;
      if (metadataConnectionId === connectionToolCallId) {
        return true;
      }
    }

    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const part of parts) {
      if (!isRecord(part)) {
        continue;
      }

      const toolName = resolveToolNameFromPart(part);
      if (!BROWSER_AUTOMATION_TOOL_NAMES.has(toolName)) {
        continue;
      }

      const input = isRecord(part.input) ? part.input : null;
      if (input?.browserConnectionToolCallId === connectionToolCallId) {
        return true;
      }
    }
  }

  return false;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

export function getBrowserConnectionStatus(output: unknown) {
  if (!isRecord(output)) {
    return null;
  }

  const status = firstString(output.status);
  return status === "connected" || status === "skipped" || status === "failed"
    ? status
    : null;
}

export function getBrowserConnectionTaskFromInput(input: unknown) {
  const normalizedInput = normalizeBrowserConnectionInput(input);
  return firstString(normalizedInput?.task);
}

export function resolveBrowserTaskText(params: {
  effectiveUserText: string;
  isBrowserConnectionContinuation: boolean;
  browserConnectionInput: unknown;
}) {
  if (!params.isBrowserConnectionContinuation) {
    return params.effectiveUserText.trim();
  }

  return getBrowserConnectionTaskFromInput(params.browserConnectionInput);
}

export function isMissingBrowserContinuationTask(params: {
  isBrowserConnectionContinuation: boolean;
  browserConnectionOutput: unknown;
  browserTaskText: string;
}) {
  return (
    params.isBrowserConnectionContinuation &&
    getBrowserConnectionStatus(params.browserConnectionOutput) ===
      "connected" &&
    !params.browserTaskText.trim()
  );
}
