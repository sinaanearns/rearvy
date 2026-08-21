import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

const ASK_USER_KINDS = [
  "clarification",
  "approval",
  "verification",
  "decision",
  "sensitive",
] as const;

const ASK_USER_PURPOSES = ["signup_account_identifier"] as const;

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

function requiredTextSchema(fieldName: string, maxLength: number) {
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

function optionalTextSchema(maxLength: number) {
  return z
    .string()
    .transform((value) => normalizeText(value, maxLength))
    .optional();
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

const askUserChoiceSchema = z.object({
  id: requiredTextSchema("choice id", 80),
  label: requiredTextSchema("choice label", 140),
  description: optionalTextSchema(500),
});

export const askUserInputSchema = z.object({
  kind: z.enum(ASK_USER_KINDS).default("clarification"),
  purpose: z.enum(ASK_USER_PURPOSES).optional(),
  title: optionalTextSchema(120),
  prompt: requiredTextSchema("prompt", 2000),
  placeholder: optionalTextSchema(240),
  context: optionalTextSchema(3000),
  choices: z.array(askUserChoiceSchema).max(6).optional(),
  allowSkip: z.boolean().default(true),
  sensitive: z.boolean().default(false),
  requestedAction: optionalTextSchema(1000),
});

export const askUserAttachmentSchema = z.object({
  name: requiredTextSchema("attachment name", 255),
  contentType: requiredTextSchema("attachment content type", 120),
  size: z.number().finite().nonnegative(),
  kind: z.enum(["image", "file"]).default("file"),
});

export const askUserOutputSchema = z.object({
  status: z.enum(["answered", "skipped", "rejected"]),
  answer: optionalTextSchema(8000),
  choice: optionalTextSchema(120),
  attachments: z.array(askUserAttachmentSchema).max(5).optional(),
  respondedAt: z.unknown().optional(),
}).transform((output) => {
  const respondedAt = normalizeTimestamp(output.respondedAt);

  return {
    status: output.status,
    ...(output.answer !== undefined ? { answer: output.answer } : {}),
    ...(output.choice !== undefined ? { choice: output.choice } : {}),
    ...(output.attachments !== undefined ? { attachments: output.attachments } : {}),
    ...(respondedAt !== undefined ? { respondedAt } : {}),
  };
});

export type AskUserInput = z.infer<typeof askUserInputSchema>;
export type AskUserOutput = z.infer<typeof askUserOutputSchema>;

export function normalizeAskUserInput(input: unknown): AskUserInput {
  return askUserInputSchema.parse(input);
}

export function normalizeAskUserOutput(output: unknown): AskUserOutput {
  return askUserOutputSchema.parse(output);
}

export function askUserTool(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      "Pause the conversation and ask the user for missing details, approval, a verification code, or a decision before continuing. Use this instead of guessing when a task cannot safely continue.",
    inputSchema: askUserInputSchema,
  });
}
