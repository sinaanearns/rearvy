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

const askUserChoiceSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(140),
  description: z.string().max(500).optional(),
});

export const askUserInputSchema = z.object({
  kind: z.enum(ASK_USER_KINDS).default("clarification"),
  purpose: z.enum(ASK_USER_PURPOSES).optional(),
  title: z.string().min(1).max(120).optional(),
  prompt: z.string().min(1).max(2000),
  placeholder: z.string().max(240).optional(),
  context: z.string().max(3000).optional(),
  choices: z.array(askUserChoiceSchema).max(6).optional(),
  allowSkip: z.boolean().default(true),
  sensitive: z.boolean().default(false),
  requestedAction: z.string().max(1000).optional(),
});

export const askUserAttachmentSchema = z.object({
  name: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  size: z.number().nonnegative(),
  kind: z.enum(["image", "file"]).default("file"),
});

export const askUserOutputSchema = z.object({
  status: z.enum(["answered", "skipped", "rejected"]),
  answer: z.string().max(8000).optional(),
  choice: z.string().max(120).optional(),
  attachments: z.array(askUserAttachmentSchema).max(5).optional(),
  respondedAt: z.string().optional(),
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
