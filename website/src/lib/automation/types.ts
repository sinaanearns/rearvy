/**
 * Shared types for the agentic browser automation system.
 * Desktop-only: these types are used in API routes that are gated behind
 * `isDesktopApp` checks. Web users receive a 403 + download redirect instead.
 */

export type AutomationStepType = "browser" | "powershell" | "api";

export interface AutomationStep {
  id: string;
  type: AutomationStepType;
  /** Short description shown in the plan card */
  description: string;
  /** What a successful outcome looks like */
  expectedOutcome: string;
  /** The actual command / URL / query to execute */
  action: string;
}

export interface AutomationPlan {
  id: string;
  task: string;
  reasoning: string;
  steps: AutomationStep[];
  createdAt: number;
}

export type StepStatus = "pending" | "running" | "verifying" | "done" | "error" | "skipped";

export interface StepResult {
  stepId: string;
  stepIndex: number;
  status: StepStatus;
  output: string | null;
  /** Base64-encoded PNG screenshot (browser steps only) */
  screenshot: string | null;
  /** AI's analysis of the screenshot / step output */
  aiVerdict: string | null;
  /** Whether AI considers the step successful */
  aiSuccess: boolean;
  error: string | null;
  durationMs: number;
}

export interface AutomationSession {
  id: string;
  plan: AutomationPlan;
  status: "pending" | "running" | "paused" | "done" | "error" | "stopped";
  currentStepIndex: number;
  results: StepResult[];
  startedAt: number;
  finishedAt: number | null;
  /** Set to true when AI encounters an error and needs user confirmation to continue */
  awaitingUserConfirmation: boolean;
  errorMessage: string | null;
}

export interface PlanRequestBody {
  task: string;
  chatId?: string | null;
}

export interface ExecuteRequestBody {
  sessionId: string;
  plan: AutomationPlan;
  /** If continuing after an error, user-confirmed to proceed */
  continueFromError?: boolean;
}

export interface StopRequestBody {
  sessionId: string;
}
