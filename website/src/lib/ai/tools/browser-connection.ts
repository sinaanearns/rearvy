import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export const browserConnectionMethodSchema = z.enum([
  "cdp-direct",
  "extension-relay",
  "managed-runner",
]);

export const requestBrowserConnectionInputSchema = z.object({
  task: z.string().min(1).max(1000),
  reason: z.string().min(1).max(1000).optional(),
  preferredMethod: browserConnectionMethodSchema.default("cdp-direct"),
  allowedMethods: z
    .array(browserConnectionMethodSchema)
    .max(3)
    .default(["cdp-direct", "extension-relay"]),
  requireFunctionalControl: z.boolean().default(true),
});

export const requestBrowserConnectionOutputSchema = z.object({
  status: z.enum(["connected", "skipped", "failed"]),
  method: browserConnectionMethodSchema.optional(),
  message: z.string().max(1000).optional(),
  connectedBrowser: z
    .object({
      name: z.string().max(120).optional(),
      version: z.string().max(120).optional(),
      webSocketDebuggerUrl: z.string().max(500).optional(),
    })
    .optional(),
  connectionMetadata: z.record(z.string(), z.unknown()).optional(),
  respondedAt: z.string().optional(),
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
      "Pause the conversation and ask the user to connect Chrome before a browser task. Use this before browser automation when Rearvy needs CDP Direct or the Browser Extension Relay to control an existing browser.",
    inputSchema: requestBrowserConnectionInputSchema,
  });
}
