import { generateText } from "ai";
import type { ToolContext } from "@/lib/ai/types";
import { createToolRegistry } from "@/lib/ai/tools";
import { resolveModelForChat, buildNoModelConfiguredMessage } from "@/lib/ai/model-router";
import type { OrchestratorStep, OrchestratorStepType } from "./types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Planner:StepExecutor");

export interface StepResult {
  ok: boolean;
  result?: unknown;
  error?: string | null;
}

/**
 * Executes a single OrchestratorStep by mapping its type to the appropriate
 * tool in the Rearvy tool registry or calling the reasoning model directly.
 */
export async function executeStep(
  step: OrchestratorStep,
  ctx: ToolContext
): Promise<StepResult> {
  log.info(`Executing step ${step.id} (${step.name}) of type ${step.type}`);

  // Determine if it is a native reasoning step or a tool execution step
  if (step.type === "llm_reasoning" || step.type === "data_analysis") {
    return handleReasoningStep(step, ctx);
  }

  // Otherwise, use tool registry
  const toolName = mapStepTypeToToolName(step.type);
  if (!toolName) {
    log.error(`Unsupported step type: ${step.type}`, { stepId: step.id });
    return { ok: false, error: `Unsupported step type: ${step.type}` };
  }

  try {
    // Standard setup for Tool Registry
    const registry = await createToolRegistry(ctx, {
      includeWebTools: true,
      includeBrowserTools: true,
      includeTerminalTools: true,
      includeFLERBAITools: ctx.isDesktopApp,
      includeMcpTools: true,
    });

    const targetTool = registry[toolName as keyof typeof registry];
    if (!targetTool) {
      log.error(`Tool "${toolName}" is not available in the current environment context.`, { stepId: step.id });
      return {
        ok: false,
        error: `Tool "${toolName}" is not configured or available in this context.`,
      };
    }

    log.info(`Executing tool "${toolName}" with args`, step.input);

    // Call execute on the tool
    const executeFn = (targetTool as { execute?: (...args: any[]) => Promise<any> }).execute;
    if (typeof executeFn !== "function") {
      return { ok: false, error: `Tool ${toolName} has no execute function.` };
    }

    const toolResult = await executeFn(step.input);

    // Standardize checking for error payload
    if (toolResult && typeof toolResult === "object" && ("ok" in toolResult && toolResult.ok === false)) {
      const errorMsg = (toolResult as { message?: string }).message || "Tool execution failed.";
      log.error(`Tool execution returned failure: ${errorMsg}`, { stepId: step.id });
      return { ok: false, error: errorMsg, result: toolResult };
    }

    log.info(`Step ${step.id} completed successfully.`);
    return { ok: true, result: toolResult };
  } catch (error) {
    log.error(`Step ${step.id} failed with exception`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Handles LLM reasoning/analysis steps using resolveModelForChat. */
async function handleReasoningStep(
  step: OrchestratorStep,
  ctx: ToolContext
): Promise<StepResult> {
  const routed = await resolveModelForChat({
    task: "deep_business_reasoning",
    routingMode: "quality",
    isDesktopApp: ctx.isDesktopApp,
  });

  if (!routed.model) {
    return { ok: false, error: buildNoModelConfiguredMessage() };
  }

  const prompt = step.input.prompt as string || step.description;

  try {
    const { text } = await generateText({
      model: routed.model,
      prompt: `Analyze the following prompt and return a clear, structured summary of your findings:\n\n${prompt}`,
    });

    return { ok: true, result: { text } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Maps an OrchestratorStepType to the corresponding key in the Tool Registry. */
function mapStepTypeToToolName(type: OrchestratorStepType): string | null {
  const mapping: Record<OrchestratorStepType, string | null> = {
    web_research: "searchWeb",
    browser_task: "runBrowserTask",
    email_draft: "prepareGmailMessage",
    memory_recall: "searchMemories",
    memory_save: "saveMemory",
    document_generate: "generateDocument",
    media_generate: null, // No longer active; kept for schema compatibility
    firecrawl_interact: "firecrawlInteract",
    desktop_workflow: "executeWorkflow",
    terminal_command: "runTerminalCommand",
    user_approval: "askUser",
    llm_reasoning: null, // Handled separately
    data_analysis: null, // Handled separately
  };

  return mapping[type] || null;
}

