import { z } from "zod";

export const EXECUTION_STAGES = [
  "understand",
  "plan",
  "execute",
  "verify",
  "recover",
  "learn",
  "report",
] as const;

export type ExecutionStage = (typeof EXECUTION_STAGES)[number];

export const STEP_STATUS = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "recovered",
  "unsupported",
  "skipped",
] as const;

export type StepStatus = (typeof STEP_STATUS)[number];

export const ExecutionStepSchema = z.object({
  id: z.string(),
  intent: z.string().describe("What this step achieves in one sentence."),
  capability: z
    .string()
    .describe(
      "Capability tag the executor uses to run the step, e.g. knowledge.learn, work.process.create, email.reply, browser.navigate.",
    ),
  params: z
    .record(z.string(), z.unknown())
    .describe("Arguments passed to the executor for this capability."),
  requiresApproval: z
    .boolean()
    .describe("True if this step must wait for explicit user confirmation."),
  verify: z
    .string()
    .describe("How to confirm this step actually succeeded."),
});

export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;

export const ExecutionPlanSchema = z.object({
  understood: z.string().describe("Restated goal in Rearvy's own words."),
  assumptions: z
    .array(z.string())
    .describe("Assumptions made while planning."),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe("Planner confidence that the plan achieves the goal."),
  steps: z.array(ExecutionStepSchema),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

export type ExecutorResult = {
  ok: boolean;
  status: StepStatus;
  detail: string;
  data?: Record<string, unknown>;
  needsApproval?: boolean;
};

export type StepRecord = ExecutionStep & {
  status: StepStatus;
  attempts: number;
  result?: ExecutorResult;
  error?: string;
};

export type ExecutionReport = {
  goal: string;
  summary: string;
  completed: number;
  failed: number;
  recovered: number;
  skipped: number;
  steps: Array<{
    intent: string;
    status: StepStatus;
    detail: string;
  }>;
  learned: boolean;
  notes: string[];
};

export type ExecutiveRequest = {
  request: string;
  userId: string;
  projectId?: string | null;
  chatId?: string | null;
  isDesktopApp?: boolean;
  approvedStepIds?: string[];
};

export type ExecutorContext = {
  userId: string;
  projectId?: string | null;
  adminDb: import("firebase-admin/firestore").Firestore;
  isDesktopApp?: boolean;
};

export type ExecutiveResult = {
  understood: string;
  plan: ExecutionPlan;
  steps: StepRecord[];
  report: ExecutionReport;
};
