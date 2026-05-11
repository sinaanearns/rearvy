/**
 * FLERB AI - Desktop Automation Tools
 * Tools for executing desktop workflows in the Electron app
 */

import type { ToolContext } from "../types";
import {
  WORKFLOW_TEMPLATES,
  createWorkflowFromTemplate,
  WorkflowPlanner,
  validateWorkflowPlan,
} from "@/lib/ai/desktop-control";

/**
 * Execute a predefined automation workflow
 */
export function executeWorkflowTool(ctx: ToolContext) {
  return {
    description:
      "Execute a predefined automation workflow (e.g., trading monitor, email, file organization). This tool sends a workflow to the Electron desktop app for execution. User must approve novel workflows.",
    parameters: {
      type: "object" as const,
      properties: {
        templateId: {
          type: "string",
          description: `ID of the predefined template. Choose from: ${WORKFLOW_TEMPLATES.map((t) => t.id).join(", ")}`,
        },
        config: {
          type: "object",
          description: "Configuration parameters for the template (varies by template)",
          properties: {},
          additionalProperties: true,
        },
      },
      required: ["templateId", "config"],
    },
    execute: async (params: { templateId: string; config: Record<string, unknown> }) => {
      try {
        const { templateId, config } = params;

        // Create workflow from template
        const workflow = createWorkflowFromTemplate(templateId, ctx.userId, config);

        if (!workflow) {
          return {
            type: "error",
            error: `Template '${templateId}' not found. Available templates: ${WORKFLOW_TEMPLATES.map((t) => t.id).join(", ")}`,
          };
        }

        // Only desktop app can execute workflows
        if (!ctx.isDesktopApp) {
          return {
            type: "error",
            error:
              "Desktop automation requires the Electron app. Please use the desktop app to execute this workflow.",
          };
        }

        // Workflows are executed via IPC in the Electron app
        // This response indicates workflow was queued
        return {
          type: "success",
          workflowId: workflow.id,
          name: workflow.name,
          status: "queued",
          message: `Workflow "${workflow.name}" queued for execution. Check the desktop app for approval prompts.`,
          steps: workflow.steps.length,
          template: templateId,
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Generate a custom workflow from natural language
 */
export function planWorkflowTool(ctx: ToolContext) {
  return {
    description:
      "Generate a custom automation workflow from a natural language description. This uses Claude to convert your request into a step-by-step automation. You must approve the plan before it executes.",
    parameters: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description:
            "What you want to automate (e.g., 'Open Excel and create a sales report', 'Monitor Bitcoin price and alert me if it exceeds $50,000')",
        },
      },
      required: ["description"],
    },
    execute: async (params: { description: string }) => {
      try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return {
            type: "error",
            error: "ANTHROPIC_API_KEY not configured",
          };
        }

        const planner = new WorkflowPlanner(apiKey);
        const plan = await planner.planWorkflow(ctx.userId, params.description);

        // Validate the plan
        const validation = validateWorkflowPlan(plan);

        if (!validation.valid) {
          return {
            type: "error",
            error: `Workflow plan is invalid: ${validation.errors.join(", ")}`,
            warnings: validation.warnings,
          };
        }

        // Only desktop app can execute workflows
        if (!ctx.isDesktopApp) {
          return {
            type: "error",
            error:
              "Workflow planning requires the Electron app. The desktop app will show an approval dialog for the generated plan.",
          };
        }

        // Plan is sent to desktop for approval dialog
        return {
          type: "success",
          workflowId: plan.workflowId,
          name: plan.name,
          status: "pending_approval",
          message: `Custom workflow generated! Check the desktop app for approval prompt.`,
          steps: plan.steps.length,
          confidence: plan.confidence,
          reasoning: plan.reasoning,
          requiresApproval: plan.requiresApproval,
          warnings: validation.warnings,
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * List available workflow templates
 */
export function listWorkflowTemplatesTool(_ctx: ToolContext) {
  return {
    description: "List all available predefined automation workflow templates with descriptions and configuration schemas",
    parameters: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["trading", "communication", "files", "reporting", "automation", "all"],
          description:
            "Filter templates by category (trading, communication, files, reporting, automation, or 'all' for no filter)",
        },
      },
    },
    execute: async (params: { category?: string }) => {
      try {
        const { category = "all" } = params;

        let templates = WORKFLOW_TEMPLATES;
        if (category !== "all" && category) {
          templates = templates.filter((t) => t.category === category);
        }

        return {
          type: "success",
          count: templates.length,
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            configSchema: t.configSchema,
          })),
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Get workflow execution status
 */
export function getWorkflowStatusTool(_ctx: ToolContext) {
  return {
    description: "Check the status of a currently executing or recently completed workflow",
    parameters: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "ID of the workflow to check status for",
        },
      },
      required: ["workflowId"],
    },
    execute: async (params: { workflowId: string }) => {
      try {
        // In the actual implementation, this would query Firestore or the Electron app
        // For now, return a message that status will be provided via IPC updates
        return {
          type: "success",
          workflowId: params.workflowId,
          message: "Workflow status available in real-time in the desktop app",
          note: "Check the ExecutionMonitor panel in the desktop app for live updates",
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Get FLERB AI tools for tool registry
 */
export async function getFLERBAITools(ctx: ToolContext) {
  return {
    executeWorkflow: executeWorkflowTool(ctx),
    planWorkflow: planWorkflowTool(ctx),
    listWorkflowTemplates: listWorkflowTemplatesTool(ctx),
    getWorkflowStatus: getWorkflowStatusTool(ctx),
  };
}
