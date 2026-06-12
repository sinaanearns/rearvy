import { tool } from "ai";
import { z } from "zod";
import { normalizeWebSocketDebuggerUrl } from "@/lib/browser-use/connection";
import type { ToolContext } from "../types";

const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/g;

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(CONTROL_CHAR_PATTERN, " ").trim();
  if (!cleaned) {
    return undefined;
  }

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function browserConnectionTextSchema(fieldName: string, maxLength: number) {
  return z.string().transform((value, ctx) => {
    const cleaned = normalizeText(value, maxLength);
    if (!cleaned) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} is required.`,
      });
      return z.NEVER;
    }

    return cleaned;
  });
}

function normalizeTimestamp(value: unknown) {
  const cleaned = normalizeText(value, 80);
  if (!cleaned) {
    return undefined;
  }

  const timestamp = Date.parse(cleaned);
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

function normalizePort(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value < 65536
    ? value
    : undefined;
}

function normalizeTabCount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10000
    ? value
    : undefined;
}

export const browserConnectionMethodSchema = z.enum([
  "cdp-direct",
  "extension-relay",
  "managed-runner",
]);

export const requestBrowserConnectionInputSchema = z.object({
  task: browserConnectionTextSchema("task", 1000),
  reason: browserConnectionTextSchema("reason", 1000).optional(),
  preferredMethod: browserConnectionMethodSchema.default("cdp-direct"),
  allowedMethods: z
    .array(browserConnectionMethodSchema)
    .max(3)
    .default(["cdp-direct", "extension-relay"]),
  requireFunctionalControl: z.boolean().default(true),
});

const requestBrowserConnectionMetadataSchema = z
  .record(z.string(), z.unknown())
  .transform((metadata) => {
    const relayPort = normalizePort(metadata.relayPort);
    const port = normalizePort(metadata.port);
    const extensionId = normalizeText(metadata.extensionId, 200);
    const tabCount = normalizeTabCount(metadata.tabCount);

    return {
      ...(relayPort !== undefined ? { relayPort } : {}),
      ...(port !== undefined ? { port } : {}),
      ...(extensionId !== undefined ? { extensionId } : {}),
      ...(tabCount !== undefined ? { tabCount } : {}),
    };
  });

const requestBrowserConnectedBrowserSchema = z
  .object({
    name: z.unknown().optional(),
    version: z.unknown().optional(),
    webSocketDebuggerUrl: z.unknown().optional(),
  })
  .transform((browser) => {
    const name = normalizeText(browser.name, 120);
    const version = normalizeText(browser.version, 120);
    const webSocketDebuggerUrl =
      normalizeWebSocketDebuggerUrl(browser.webSocketDebuggerUrl) ?? undefined;

    return {
      ...(name !== undefined ? { name } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(webSocketDebuggerUrl !== undefined ? { webSocketDebuggerUrl } : {}),
    };
  });

export const requestBrowserConnectionOutputSchema = z
  .object({
    status: z.enum(["connected", "skipped", "failed"]),
    method: browserConnectionMethodSchema.optional(),
    message: z.unknown().optional(),
    connectedBrowser: requestBrowserConnectedBrowserSchema.optional(),
    connectionMetadata: requestBrowserConnectionMetadataSchema.optional(),
    respondedAt: z.unknown().optional(),
  })
  .transform((output) => {
    const message = normalizeText(output.message, 1000);
    const respondedAt = normalizeTimestamp(output.respondedAt);

    return {
      status: output.status,
      ...(output.method !== undefined ? { method: output.method } : {}),
      ...(message !== undefined ? { message } : {}),
      ...(output.connectedBrowser !== undefined
        ? { connectedBrowser: output.connectedBrowser }
        : {}),
      ...(output.connectionMetadata !== undefined
        ? { connectionMetadata: output.connectionMetadata }
        : {}),
      ...(respondedAt !== undefined ? { respondedAt } : {}),
    };
  });

export type BrowserConnectionMethod = z.infer<
  typeof browserConnectionMethodSchema
>;
export type RequestBrowserConnectionInput = z.infer<
  typeof requestBrowserConnectionInputSchema
>;
export type RequestBrowserConnectionOutput = z.infer<
  typeof requestBrowserConnectionOutputSchema
>;

export function normalizeRequestBrowserConnectionInput(
  input: unknown
): RequestBrowserConnectionInput {
  return requestBrowserConnectionInputSchema.parse(input);
}

export function normalizeRequestBrowserConnectionOutput(
  output: unknown
): RequestBrowserConnectionOutput {
  return requestBrowserConnectionOutputSchema.parse(output);
}

export function requestBrowserConnectionTool(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      "Pause the conversation and ask the user to connect a supported browser before a browser task. Use this before browser automation when Rearvy needs CDP Direct or the Browser Extension Relay to control an existing browser.",
    inputSchema: requestBrowserConnectionInputSchema,
  });
}
