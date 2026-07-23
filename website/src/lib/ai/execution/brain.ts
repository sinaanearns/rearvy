import { z } from "zod";
import { generateObject, generateText } from "ai";
import { createToolRegistry } from "@/lib/ai/tools";
import { resolveModelForChat, buildNoModelConfiguredMessage } from "@/lib/ai/model-router";
import { buildSystemPrompt, loadSystemPromptContext } from "@/lib/ai/system-prompt";
import { adminDb } from "@/lib/firebase/admin";
import {
  OrchestratorPlan,
  OrchestratorStep,
  DEFAULT_CONFIDENCE_GATE,
} from "@/lib/ai/planner/types";
import { OrchestratorPlanSchema } from "@/lib/ai/planner/schemas";
import { parseExecutionIntent } from "./router";
import type { ExecutionIntent } from "./router";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Execution:Brain");

export interface ExecutionContext {
  userId: string;
  projectId?: string | null;
  chatId?: string | null;
  isDesktopApp?: boolean;
  allowedMcpServerIds?: string[] | null;
  allowedTools?: string[] | null;
}

export interface ExecutionStepResult {
  id: string;
  name: string;
  status: "running" | "succeeded" | "failed" | "skipped" | "awaiting_approval";
  result?: unknown;
  error?: string;
}

export interface ExecutionResult {
  understood: string;
  plan: OrchestratorPlan | null;
  steps: ExecutionStepResult[];
  summary: string;
  confidence: number;
  needsApproval: boolean;
  intent: ExecutionIntent;
  error?: string;
}

function buildPlanGoal(originalGoal: string, intent: ExecutionIntent): string {
  if (intent.category === "chat") {
    return originalGoal;
  }
  return `[${intent.category}] ${intent.action}`;
}

export async function executeGoal(goal: string, ctx: ExecutionContext): Promise<ExecutionResult> {
  log.info("Executing goal via Unified Execution Brain", { userId: ctx.userId, goal: goal.slice(0, 80) });

  const intent = await parseExecutionIntent(goal, {
    userId: ctx.userId,
    isDesktopApp: ctx.isDesktopApp,
  });

  if (intent.category === "chat") {
    return {
      understood: goal,
      plan: null,
      steps: [],
      summary: "Handled as conversational response.",
      confidence: intent.confidence,
      needsApproval: false,
      intent,
    };
  }

  if (intent.requiresMultiStep || intent.sensitivity !== "safe") {
    return await executeWithPlan(goal, intent, ctx);
  }

  return await executeSingleTool(goal, intent, ctx);
}

async function executeSingleTool(goal: string, intent: ExecutionIntent, ctx: ExecutionContext): Promise<ExecutionResult> {
  const toolHints = getSuggestedTools(intent);
  const toolName = toolHints[0] || null;

  if (!toolName) {
    return {
      understood: goal,
      plan: null,
      steps: [],
      summary: "No specific tool matched. Please provide more context.",
      confidence: 0.3,
      needsApproval: false,
      intent,
    };
  }

  try {
    const registry = await createToolRegistry(
      {
        userId: ctx.userId,
        projectId: ctx.projectId ?? null,
        isDesktopApp: ctx.isDesktopApp ?? false,
        adminDb,
      },
      {
        includeFLERBAITools: ctx.isDesktopApp,
        includeMcpTools: true,
        allowedMcpServerIds: ctx.allowedMcpServerIds ?? null,
        allowedToolNames: ctx.allowedTools ?? [toolName],
      }
    );

    const targetTool = registry[toolName as keyof typeof registry];
    if (!targetTool || typeof targetTool !== "object" || !("execute" in targetTool)) {
      return {
        understood: goal,
        plan: null,
        steps: [],
        summary: `Tool "${toolName}" is not available in this environment.`,
        confidence: 0.5,
        needsApproval: false,
        intent,
      };
    }

    const executeFn = (targetTool as unknown as { execute: (input: unknown) => Promise<unknown> }).execute;
    const toolResult = await executeFn(intent.parameters);

    return {
      understood: goal,
      plan: null,
      steps: [
        {
          id: "step_1",
          name: toolName,
          status: typeof toolResult === "object" && toolResult !== null && "ok" in toolResult && (toolResult as { ok: unknown }).ok === false
            ? "failed"
            : "succeeded",
          result: toolResult,
          error: typeof toolResult === "object" && toolResult !== null && "error" in toolResult && typeof (toolResult as { error: unknown }).error === "string"
            ? (toolResult as { error: string }).error
            : undefined,
        },
      ],
      summary: typeof toolResult === "object" && toolResult !== null && "ok" in toolResult && (toolResult as { ok: unknown }).ok === false
        ? `Tool "${toolName}" failed: ${(toolResult as { error?: string }).error}`
        : `Executed ${toolName} successfully.`,
      confidence: 0.8,
      needsApproval: intent.sensitivity === "high",
      intent,
    };
  } catch (error) {
    return {
      understood: goal,
      plan: null,
      steps: [
        {
          id: "step_1",
          name: toolName,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        },
      ],
      summary: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
      confidence: 0.5,
      needsApproval: false,
      intent,
    };
  }
}

async function executeWithPlan(goal: string, intent: ExecutionIntent, ctx: ExecutionContext): Promise<ExecutionResult> {
  const planGoal = buildPlanGoal(goal, intent);

  try {
    const plan = await generateExecutionPlan({
      userId: ctx.userId,
      chatId: ctx.chatId ?? null,
      projectId: ctx.projectId ?? null,
      goal: planGoal,
      isDesktopApp: ctx.isDesktopApp,
      extraContext: {
        originalGoal: goal,
        userIntent: intent,
      },
    });

    const needsApproval = plan.requires_approval || intent.sensitivity === "high";

    if (needsApproval) {
      return {
        understood: plan.goal,
        plan,
        steps: plan.steps.map((s) => ({
          id: s.id,
          name: s.name,
          status: "skipped" as const,
          error: "Pending approval gate.",
        })),
        summary: `Plan generated (${plan.steps.length} steps). Approval required: ${plan.assumptions.join("; ")}.`,
        confidence: plan.confidence_score,
        needsApproval: true,
        intent,
      };
    }

    const executedSteps: ExecutionStepResult[] = [];
    const registry = await createToolRegistry(
      {
        userId: ctx.userId,
        projectId: ctx.projectId ?? null,
        isDesktopApp: ctx.isDesktopApp ?? false,
        adminDb,
      },
      {
        includeFLERBAITools: ctx.isDesktopApp,
        includeMcpTools: true,
        allowedMcpServerIds: ctx.allowedMcpServerIds ?? null,
        allowedToolNames: ctx.allowedTools ?? null,
      }
    );

    const stepRegistry = buildStepRegistry(registry);

    for (const step of plan.steps) {
      executedSteps.push({
        id: step.id,
        name: step.name,
        status: "running",
      });

      try {
        const result = await runPlannedStep(step, stepRegistry, ctx.userId, ctx.isDesktopApp);
        const resultObj = result as Record<string, unknown> | undefined;
        executedSteps[executedSteps.length - 1] = {
          ...executedSteps[executedSteps.length - 1],
          status: resultObj?.ok !== false ? "succeeded" : "failed",
          result,
          error: resultObj?.ok === false && typeof resultObj === "object" && resultObj !== null && "error" in resultObj
            ? (resultObj as { error: unknown }).error as string
            : undefined,
        };
      } catch (err) {
        executedSteps[executedSteps.length - 1] = {
          ...executedSteps[executedSteps.length - 1],
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const completedCount = executedSteps.filter((s) => s.status === "succeeded").length;
    const failedCount = executedSteps.filter((s) => s.status === "failed").length;

    return {
      understood: goal,
      plan,
      steps: executedSteps,
      summary: failedCount === 0
        ? `Completed all ${completedCount} steps.`
        : `Partially completed: ${completedCount} succeeded, ${failedCount} failed.`,
      confidence: plan.confidence_score,
      needsApproval: false,
      intent,
    };
  } catch (error) {
    return {
      understood: goal,
      plan: null,
      steps: [],
      summary: `Plan execution failed: ${error instanceof Error ? error.message : String(error)}`,
      confidence: 0.2,
      needsApproval: false,
      intent,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildStepRegistry(registry: Record<string, unknown>): Record<string, unknown> {
  const stepRegistry: Record<string, unknown> = {};

  for (const [name, tool] of Object.entries(registry)) {
    if (tool && typeof tool === "object" && "execute" in (tool as Record<string, unknown>) && typeof (tool as { execute?: unknown }).execute === "function") {
      stepRegistry[name] = (tool as { execute: (input: unknown) => Promise<unknown> }).execute;
    }
  }

  return stepRegistry;
}

async function runPlannedStep(
  step: OrchestratorStep,
  stepRegistry: Record<string, unknown>,
  userId: string,
  isDesktopApp?: boolean
): Promise<unknown> {
  if (step.type === "llm_reasoning" || step.type === "data_analysis") {
    return handleReasoningStep(step, userId, isDesktopApp);
  }

  const toolName = mapStepTypeToToolName(step.type);
  if (!toolName) {
    return { ok: false, error: `Unsupported step type: ${step.type}` };
  }

  const executeFn = stepRegistry[toolName] as ((input: unknown) => Promise<unknown>) | undefined;
  if (!executeFn) {
    return { ok: false, error: `Tool "${toolName}" is not available in the current context.` };
  }

  return executeFn(step.input);
}

async function handleReasoningStep(
  step: OrchestratorStep,
  userId: string,
  isDesktopApp?: boolean
): Promise<unknown> {
  const routed = await resolveModelForChat({
    task: "deep_business_reasoning",
    routingMode: "quality",
    isDesktopApp,
  });

  if (!routed.model) {
    return { ok: false, error: buildNoModelConfiguredMessage() };
  }

  const prompt = (step.input.prompt || step.description) as string;

  try {
    const { text } = await generateText({
      model: routed.model,
      prompt: `Analyze the following prompt and return a clear, structured summary of your findings:\n\n${prompt}`,
    });

    return { ok: true, text };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function mapStepTypeToToolName(type: OrchestratorStep["type"]): string | null {
  const mapping: Record<OrchestratorStep["type"], string | null> = {
    web_research: "searchWeb",
    browser_task: "runBrowserTask",
    email_draft: "prepareGmailMessage",
    memory_recall: "searchMemories",
    memory_save: "saveMemory",
    document_generate: "generateDocument",
    media_generate: null,
    desktop_workflow: "executeWorkflow",
    terminal_command: "runTerminalCommand",
    user_approval: "askUser",
    llm_reasoning: null,
    data_analysis: null,
  };

  return mapping[type] || null;
}

function getSuggestedTools(intent: ExecutionIntent): string[] {
  const map: Record<string, string[]> = {
    browser: ["runBrowserTask", "searchWeb"],
    chat: [],
    code: ["runTerminalCommand"],
    desktop: ["executeWorkflow"],
    email: ["prepareGmailMessage"],
    file: ["readFile", "writeFile", "listDirectory"],
    memory: ["searchMemories", "saveMemory"],
    media: ["analyzeMedia"],
    research: ["searchWeb", "fetchWebPage"],
    terminal: ["runTerminalCommand"],
    trading: ["getTradingOpinion", "getBestTradeOpportunity"],
    automation: ["runBrowserTask"],
    calendar: ["getCalendarEvents", "createCalendarEvent"],
    knowledge: ["saveMemory"],
    integration: ["getIntegrationStatus"],
  };

  return map[intent.category] || [];
}

const EXECUTION_PLAN_SYSTEM = `You are the Rearvy Orchestration Planner. Break the user's goal into a small ordered list of executable steps.

Available tool mappings:
- searchWeb → web_research
- runBrowserTask → browser_task
- prepareGmailMessage → email_draft
- searchMemories → memory_recall
- saveMemory → memory_save
- runTerminalCommand → terminal_command
- executeWorkflow → desktop_workflow
- generateDocument → document_generate
- askUser → user_approval

Use llm_reasoning for pure analysis steps that don't map to a specific tool.
Mark requiresApproval = true for irreversible operations (email sends, shell commands, file writes, desktop automation, financial operations).
Each step must have a unique snake_case id (e.g., step_1, research_competitors).
Steps should be concrete, not vague. Maximum 10 steps.`;

interface GeneratePlanOptions {
  userId: string;
  chatId: string | null;
  projectId: string | null;
  goal: string;
  isDesktopApp?: boolean;
  extraContext?: Record<string, unknown>;
}

async function generateExecutionPlan(options: GeneratePlanOptions): Promise<OrchestratorPlan> {
  const { userId, projectId, goal, isDesktopApp, extraContext } = options;

  const context = await loadSystemPromptContext({
    userId,
    projectId,
    adminDb,
    responseMode: "deep",
  });

  const systemPrompt = buildSystemPrompt({
    context,
    isDesktopApp: isDesktopApp ?? false,
    responseMode: "deep",
    webResearchMode: "tools",
    desktopToolContext: {
      hasDesktopWorkflowTools: isDesktopApp ?? false,
      hasBrowserTools: isDesktopApp ?? false,
      hasTerminalTools: isDesktopApp ?? false,
      hasExternalMcpTools: true,
    },
  });

  const routed = await resolveModelForChat({
    task: "deep_business_reasoning",
    routingMode: "quality",
    isDesktopApp: isDesktopApp ?? false,
  });

  if (!routed.model) {
    throw new Error(buildNoModelConfiguredMessage());
  }

  const contextLines = extraContext
    ? `\n\nAdditional context:\n${JSON.stringify(extraContext, null, 2)}`
    : "";

  const response = await generateObject({
    model: routed.model,
    schema: OrchestratorPlanSchema,
    system: `${systemPrompt}\n\n${EXECUTION_PLAN_SYSTEM}`,
    prompt: `Goal: "${goal}"\n\nBreak this into executable steps.${contextLines}`,
    temperature: 0.1,
  });

  const plan = response.object as OrchestratorPlan;
  plan.goal = goal;

  const threshold = DEFAULT_CONFIDENCE_GATE.threshold;
  const hasSensitiveStep = plan.steps.some(
    (s) =>
      s.requiresApproval ||
      ["email_draft", "terminal_command", "desktop_workflow", "user_approval"].includes(s.type)
  );

  plan.requires_approval = plan.confidence_score < threshold || hasSensitiveStep;

  log.info("Plan generated", {
    steps: plan.steps.length,
    confidence: plan.confidence_score,
    requiresApproval: plan.requires_approval,
  });

  return plan;
}
