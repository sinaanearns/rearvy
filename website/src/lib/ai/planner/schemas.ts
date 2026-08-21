/**
 * AI Brain — Zod Schemas for JSON-First LLM Outputs
 *
 * These schemas enforce structural integrity on every plan the model generates.
 * Using `generateObject` with these schemas guarantees the model cannot return
 * free-form text or skip required fields like assumptions[] or confidence_score.
 */

import { z } from "zod";
import type { OrchestratorStepType } from "./types";

// ---------------------------------------------------------------------------
// Step Type Enum
// ---------------------------------------------------------------------------

const STEP_TYPES: [OrchestratorStepType, ...OrchestratorStepType[]] = [
  "web_research",
  "browser_task",
  "email_draft",
  "memory_recall",
  "memory_save",
  "data_analysis",
  "document_generate",
  "media_generate",
  "desktop_workflow",
  "terminal_command",
  "llm_reasoning",
  "user_approval",
];

// ---------------------------------------------------------------------------
// Step Schema
// ---------------------------------------------------------------------------

export const OrchestratorStepSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Step ID must be lowercase alphanumeric with underscores")
    .describe(
      "Unique step identifier within the plan. Use snake_case, e.g. 'step_1', 'research_competitors'."
    ),

  name: z
    .string()
    .min(1)
    .max(100)
    .describe("Short human-readable step name shown in UI progress, e.g. 'Research top competitors'."),

  description: z
    .string()
    .min(1)
    .max(500)
    .describe(
      "Detailed description of what this step will do and why it is needed."
    ),

  type: z
    .enum(STEP_TYPES)
    .describe(
      "The type of work this step performs. Determines which Rearvy capability handles execution. " +
        "Use 'llm_reasoning' for pure analysis, 'web_research' for internet lookups, " +
        "'user_approval' when explicit human confirmation is required before proceeding."
    ),

  input: z
    .record(z.string(), z.unknown())
    .describe(
      "Step-specific input parameters. For web_research: { query: string }. " +
        "For email_draft: { to: string, subject: string, body_hint: string }. " +
        "For llm_reasoning: { prompt: string }. " +
        "For user_approval: { message: string, context: string }."
    ),

  dependencies: z
    .array(z.string())
    .describe(
      "IDs of steps that must complete successfully before this step can begin. " +
        "Empty array means this step can start immediately. " +
        "Do NOT create circular dependencies."
    ),

  requiresApproval: z
    .boolean()
    .describe(
      "Set true if this step takes an irreversible or high-risk action: " +
        "sending emails, running shell commands, desktop automation, " +
        "deleting data, or any financial operation. When true, execution pauses " +
        "and uses the askUser tool to get explicit user confirmation."
    ),
});

// ---------------------------------------------------------------------------
// Plan Schema
// ---------------------------------------------------------------------------

export const OrchestratorPlanSchema = z.object({
  goal: z
    .string()
    .min(1)
    .max(1000)
    .describe("The exact user goal this plan is designed to achieve."),

  assumptions: z
    .array(z.string().min(1).max(300))
    .min(1)
    .max(10)
    .describe(
      "REQUIRED. List every assumption you are making to generate this plan. " +
        "Include assumptions about: user intent, available integrations, data availability, " +
        "and external service access. Minimum 1 assumption. " +
        "Example: 'User has Gmail integration connected', 'Shopify store has products'."
    ),

  confidence_score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Your confidence that this plan is correct, achievable, and safe to execute (0.0–1.0). " +
        "Score below 0.7 will pause execution for user review. " +
        "Be honest — do not inflate this score. " +
        "Factors that reduce confidence: missing integration context, ambiguous user intent, " +
        "steps requiring external data you cannot verify, or irreversible actions."
    ),

  steps: z
    .array(OrchestratorStepSchema)
    .min(1)
    .max(12)
    .describe(
      "Ordered list of steps to execute. Maximum 12 steps. " +
        "Each step must be concrete and actionable — not vague. " +
        "Use dependencies[] to express ordering requirements. " +
        "If a step is complex, break it into smaller steps rather than one large step."
    ),

  summary: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "Short summary of the entire plan shown to the user before they approve execution. " +
        "Be specific about what will be done. Max 300 characters."
    ),

  estimated_duration_ms: z
    .number()
    .min(1000)
    .describe(
      "Rough estimated total wall-clock time to complete all steps in milliseconds. " +
        "Be realistic: web research ≈ 5000ms, LLM reasoning ≈ 3000ms, " +
        "browser tasks ≈ 30000ms, email drafting ≈ 2000ms."
    ),

  requires_approval: z
    .boolean()
    .describe(
      "Set true if ANY step has requiresApproval=true OR if confidence_score < 0.7. " +
        "This controls whether the orchestration endpoint pauses before execution."
    ),
});

// ---------------------------------------------------------------------------
// Exported TypeScript types inferred from schemas
// ---------------------------------------------------------------------------

export type OrchestratorStepInput = z.infer<typeof OrchestratorStepSchema>;
export type OrchestratorPlanInput = z.infer<typeof OrchestratorPlanSchema>;
