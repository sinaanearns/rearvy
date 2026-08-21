import { generateObject } from "ai";
import { resolveModelForChat, buildNoModelConfiguredMessage } from "@/lib/ai/model-router";
import { buildSystemPrompt, loadSystemPromptContext } from "@/lib/ai/system-prompt";
import { adminDb } from "@/lib/firebase/admin";
import { OrchestratorPlanSchema } from "./schemas";
import type { OrchestratorPlan } from "./types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Planner:PlanGenerator");

export interface GeneratePlanOptions {
  userId: string;
  chatId: string;
  projectId?: string | null;
  goal: string;
  isDesktopApp?: boolean;
}

/**
 * Generates a structured multi-step execution plan for a user's goal.
 *
 * Uses the existing ModelRouter to select a high-quality model (e.g. Nemotron/DeepSeek)
 * and generateObject to validate the output structure using OrchestratorPlanSchema.
 */
export async function generateExecutionPlan(
  options: GeneratePlanOptions
): Promise<OrchestratorPlan> {
  const { userId, chatId, projectId = null, goal, isDesktopApp = false } = options;

  log.info(`Generating execution plan for user ${userId}, goal: "${goal.substring(0, 60)}..."`);

  // 1. Load context from Firestore using existing loader
  const context = await loadSystemPromptContext({
    userId,
    projectId,
    adminDb,
    responseMode: "deep",
  });

  // 2. Build system prompt
  const systemPrompt = buildSystemPrompt({
    context,
    isDesktopApp,
    responseMode: "deep",
    webResearchMode: "tools",
    desktopToolContext: {
      hasDesktopWorkflowTools: isDesktopApp,
      hasBrowserTools: isDesktopApp,
      hasTerminalTools: isDesktopApp,
      hasExternalMcpTools: true,
    },
  });

  // 3. Resolve quality model for reasoning task
  const routed = await resolveModelForChat({
    task: "deep_business_reasoning",
    routingMode: "quality",
    isDesktopApp,
  });

  if (!routed.model) {
    const errorMsg = buildNoModelConfiguredMessage();
    log.error("Plan generation aborted: No model routed.", { userId, chatId });
    throw new Error(errorMsg);
  }

  // 4. Prompt construction for execution planner
  const prompt = [
    `You are the Orchestration Planner for Rearvy, an AI Business Operating System.`,
    `Your goal is to generate a multi-step execution plan to satisfy the user's objective:`,
    `---`,
    `USER GOAL: "${goal}"`,
    `---`,
    `INSTRUCTIONS:`,
    `- Break down the user's goal into logical, sequential steps.`,
    `- Declare dependencies between steps using the step IDs. For example, if step 2 needs data from step 1, step 2 must have "dependencies": ["step_1"].`,
    `- Be honest about your confidence score. If requirements are ambiguous or you lack integration context, lower the confidence score.`,
    `- Explicitly list all assumptions you are making.`,
    `- Mark steps as requiring approval (requiresApproval: true) if they perform irreversible operations like drafting/sending email, running shell commands, writing/deleting desktop files, or any financial commits.`,
    `- Match the steps to valid OrchestratorStepType capabilities: 'web_research', 'browser_task', 'email_draft', 'memory_recall', 'memory_save', 'data_analysis', 'document_generate', 'media_generate', 'desktop_workflow', 'terminal_command', 'llm_reasoning', or 'user_approval'.`,
  ].join("\n");

  try {
    const response = await generateObject({
      model: routed.model,
      schema: OrchestratorPlanSchema,
      system: systemPrompt,
      prompt,
      temperature: 0.1,
    });

    const plan = response.object as OrchestratorPlan;

    // Enforce that the plan has the goal we requested
    plan.goal = goal;

    // Determine if any step or the plan itself requires approval
    const threshold = 0.7;
    const hasSensitiveStep = plan.steps.some(
      (s) =>
        s.requiresApproval ||
        s.type === "email_draft" ||
        s.type === "terminal_command" ||
        s.type === "desktop_workflow" ||
        s.type === "user_approval"
    );

    plan.requires_approval = plan.confidence_score < threshold || hasSensitiveStep;

    log.info(`Plan generated successfully. Steps: ${plan.steps.length}, Confidence: ${plan.confidence_score}, Requires Approval: ${plan.requires_approval}`);
    return plan;
  } catch (error) {
    log.error("Failed to generate plan via LLM", error);
    throw new Error(`Plan generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
