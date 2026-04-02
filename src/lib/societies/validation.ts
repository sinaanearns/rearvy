import { z } from "zod";

/**
 * Society Validation Schemas
 */

export const SocietyCategoryEnum = z.enum([
  "tech",
  "ecommerce",
  "saas",
  "content",
  "other",
]);

export const SocietyStatusEnum = z.enum([
  "ideation",
  "approved",
  "active",
  "completed",
  "archived",
]);

export const SocietyStageEnum = z.enum([
  "formation",
  "building",
  "scaling",
  "exiting",
]);

export const SocietyMemberStatusEnum = z.enum([
  "invited",
  "pending_acceptance",
  "active",
  "inactive",
  "removed",
]);

export const SocietyMemberRoleEnum = z.enum(["founder", "member"]);

export const ContributionTypeEnum = z.enum([
  "code",
  "marketing",
  "sales",
  "design",
  "strategy",
  "operations",
  "other",
]);

export const ContributionStatusEnum = z.enum([
  "in_progress",
  "completed",
  "verified",
]);

export const TransactionTypeEnum = z.enum([
  "revenue_in",
  "expense",
  "distribution",
  "adjustment",
]);

export const ChatTypeEnum = z.enum([
  "system_general",
  "system_important",
  "system_announcements",
  "direct",
  "group",
]);

/**
 * Input Schemas
 */

export const CreateSocietySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
  category: SocietyCategoryEnum,
});

export type CreateSocietyInput = z.infer<typeof CreateSocietySchema>;

export const UpdateSocietySchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  status: SocietyStatusEnum.optional(),
  stage: SocietyStageEnum.optional(),
});

export type UpdateSocietyInput = z.infer<typeof UpdateSocietySchema>;

export const InviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  initial_ownership_percent: z
    .number()
    .min(0, "Ownership must be >= 0")
    .max(100, "Ownership must be <= 100"),
  message: z.string().max(500).optional(),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberOwnershipSchema = z.object({
  ownership_percent: z
    .number()
    .min(0)
    .max(100)
    .optional(),
  status: SocietyMemberStatusEnum.optional(),
});

export type UpdateMemberOwnershipInput = z.infer<
  typeof UpdateMemberOwnershipSchema
>;

export const AssignRoleSchema = z.object({
  user_id: z.string().min(1),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  responsibilities: z.array(z.string()).optional(),
});

export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;

export const LogContributionSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  contribution_type: ContributionTypeEnum,
  hours_spent: z
    .number()
    .min(0.25, "Minimum 15 minutes")
    .max(24, "Maximum 24 hours per log"),
});

export type LogContributionInput = z.infer<typeof LogContributionSchema>;

export const VerifyContributionSchema = z.object({
  status: ContributionStatusEnum,
  notes: z.string().max(500).optional(),
});

export type VerifyContributionInput = z.infer<typeof VerifyContributionSchema>;

export const LogTransactionSchema = z.object({
  transaction_type: TransactionTypeEnum,
  amount: z.number().min(0),
  currency: z.string().length(3).default("USD"),
  description: z.string().max(500),
  source: z.string().max(200).optional(),
});

export type LogTransactionInput = z.infer<typeof LogTransactionSchema>;

export const DistributeRevenueSchema = z.object({
  revenue_amount: z.number().min(0),
  description: z.string().max(500).optional(),
});

export type DistributeRevenueInput = z.infer<typeof DistributeRevenueSchema>;

/**
 * Response Schemas (for API validation)
 */

export const SocietyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: SocietyCategoryEnum,
  status: SocietyStatusEnum,
  stage: SocietyStageEnum,
  founder_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  member_count: z.number(),
  total_revenue: z.number().optional(),
});

export type SocietyResponse = z.infer<typeof SocietyResponseSchema>;
