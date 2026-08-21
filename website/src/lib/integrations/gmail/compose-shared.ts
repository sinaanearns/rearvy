import { z } from "zod";

const gmailEmailSchema = z.string().trim().email().max(320);

const gmailOptionalRecipientsSchema = z
  .array(gmailEmailSchema)
  .max(10)
  .optional()
  .default([]);

export const gmailComposePayloadSchema = z.object({
  to: z.array(gmailEmailSchema).min(1).max(10),
  cc: gmailOptionalRecipientsSchema,
  bcc: gmailOptionalRecipientsSchema,
  subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(10000),
});

export const gmailComposeToolInputSchema = gmailComposePayloadSchema.extend({
  sendNowPreferred: z.boolean().optional().default(false),
});

export const gmailSendActionRequestSchema = z.object({
  action: z.enum(["draft", "send"]),
  fromEmail: gmailEmailSchema.optional(),
  draft: gmailComposePayloadSchema,
});

export type GmailComposePayload = z.infer<typeof gmailComposePayloadSchema>;
export type GmailComposeToolInput = z.infer<typeof gmailComposeToolInputSchema>;
export type GmailSendActionRequest = z.infer<
  typeof gmailSendActionRequestSchema
>;

export type GmailSendAsOption = {
  email: string;
  displayName: string | null;
  isPrimary: boolean;
  isDefault: boolean;
  replyToAddress: string | null;
};

export type GmailComposeCapabilities = {
  canCreateDraft: boolean;
  canSend: boolean;
};

export type GmailComposeReviewResult = {
  kind: "gmail-compose-review";
  ok: true;
  message: string;
  accountName: string;
  selectedFrom: GmailSendAsOption;
  availableFrom: GmailSendAsOption[];
  draft: GmailComposePayload;
  defaultAction: "draft" | "send";
  capabilities: GmailComposeCapabilities;
  reconnectRequired: boolean;
  warning: string | null;
};

export type GmailComposeErrorResult = {
  kind: "gmail-compose-review";
  ok: false;
  errorCode: string;
  message: string;
  reconnectRequired: boolean;
};

export type GmailComposeToolResult =
  | GmailComposeReviewResult
  | GmailComposeErrorResult;
