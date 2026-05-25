/**
 * Desktop automation tools.
 * These tools only prepare workflow payloads; Electron executes them through IPC.
 */

import type { ToolContext } from "../types";
import type { Workflow } from "@/lib/ai/desktop-control/types";
import {
  WORKFLOW_TEMPLATES,
  createWorkflowFromTemplate,
} from "@/lib/ai/desktop-control/workflow-templates";

type DesktopWorkflowSource = "chat-tool" | "template" | "test";

type DesktopWorkflowStepInput = {
  id?: string;
  name?: string;
  description?: string;
  action?: { type?: string; [key: string]: unknown };
  timeout?: number;
  retry?: { max?: number; backoffMs?: number };
};

type DesktopWorkflowPayload = {
  id: string;
  name: string;
  description?: string;
  source: DesktopWorkflowSource;
  requiresApproval: true;
  steps: Array<{
    id: string;
    name: string;
    description?: string;
    action: { type: string; [key: string]: unknown };
    timeout?: number;
    retry?: { max: number; backoffMs: number };
  }>;
};

const ALLOWED_ACTION_TYPES = new Set([
  "screenshot",
  "wait",
  "launchApp",
  "closeWindow",
  "click",
  "moveMouse",
  "type",
  "keyPress",
  "setClipboard",
  "getClipboard",
  "scroll",
]);

const DANGEROUS_ACTION_PATTERNS = [
  "delete",
  "remove",
  "uninstall",
  "format",
  "shutdown",
  "restart",
  "logout",
  "chmod",
  "chown",
];

function makeWorkflowId(prefix = "desktop_workflow") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hasDangerousActionText(value: unknown) {
  const serialized = JSON.stringify(value ?? {}).toLowerCase();
  return DANGEROUS_ACTION_PATTERNS.some((pattern) => serialized.includes(pattern));
}

function normalizeAction(action: DesktopWorkflowStepInput["action"]) {
  if (!action || typeof action !== "object") {
    throw new Error("Each workflow step needs an action object.");
  }

  const type = typeof action.type === "string" ? action.type.trim() : "";
  if (!ALLOWED_ACTION_TYPES.has(type)) {
    throw new Error(`Unsupported desktop action type: ${type || "unknown"}`);
  }

  if (hasDangerousActionText(action)) {
    throw new Error("This workflow contains a potentially destructive action and was blocked.");
  }

  return { ...action, type };
}

function normalizeStep(step: DesktopWorkflowStepInput, index: number) {
  const action = normalizeAction(step.action);

  return {
    id: typeof step.id === "string" && step.id.trim() ? step.id.trim() : `step_${index + 1}`,
    name: typeof step.name === "string" && step.name.trim() ? step.name.trim() : `Step ${index + 1}`,
    description: typeof step.description === "string" ? step.description : undefined,
    action,
    timeout:
      typeof step.timeout === "number" && Number.isFinite(step.timeout)
        ? Math.max(500, step.timeout)
        : undefined,
    retry:
      step.retry && typeof step.retry === "object"
        ? {
            max:
              typeof step.retry.max === "number" && Number.isFinite(step.retry.max)
                ? Math.max(1, Math.floor(step.retry.max))
                : 1,
            backoffMs:
              typeof step.retry.backoffMs === "number" && Number.isFinite(step.retry.backoffMs)
                ? Math.max(0, step.retry.backoffMs)
                : 1000,
          }
        : undefined,
  };
}

function createWorkflowPayload(params: {
  id?: string;
  name?: string;
  description?: string;
  source: DesktopWorkflowSource;
  steps: DesktopWorkflowStepInput[];
}): DesktopWorkflowPayload {
  if (!params.steps.length) {
    throw new Error("Workflow must include at least one executable step.");
  }

  return {
    id: typeof params.id === "string" && params.id.trim() ? params.id.trim() : makeWorkflowId(),
    name: typeof params.name === "string" && params.name.trim() ? params.name.trim() : "Desktop Workflow",
    description: params.description,
    source: params.source,
    requiresApproval: true,
    steps: params.steps.map(normalizeStep),
  };
}

function workflowFromTemplate(workflow: Workflow, source: DesktopWorkflowSource): DesktopWorkflowPayload {
  return createWorkflowPayload({
    id: workflow.id,
    name: workflow.name,
    description: workflow.metadata?.type ? String(workflow.metadata.type) : undefined,
    source,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      name: step.name,
      description: step.description,
      action: step.action as { type?: string; [key: string]: unknown },
      timeout: step.timeout,
      retry: step.retry,
    })),
  });
}

function parseWaitMs(description: string) {
  const match = description.match(/\bwait(?:\s+for)?\s+(\d+(?:\.\d+)?)\s*(milliseconds?|ms|seconds?|secs?|s)?\b/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = (match[2] || "seconds").toLowerCase();
  if (!Number.isFinite(amount)) {
    return null;
  }

  return unit === "ms" || unit.startsWith("millisecond")
    ? Math.round(amount)
    : Math.round(amount * 1000);
}

function createFallbackSteps(description: string): DesktopWorkflowStepInput[] {
  const lower = description.toLowerCase();
  const steps: DesktopWorkflowStepInput[] = [];
  const waitMs = parseWaitMs(description);
  const url = description.match(/https?:\/\/[^\s)]+/i)?.[0];

  if (url && /\b(open|launch|navigate|visit)\b/i.test(description)) {
    steps.push({
      id: "step_open_url",
      name: "Open URL",
      action: { type: "launchApp", appPath: url, wait: true },
      timeout: 10000,
    });
  }

  if (lower.includes("screenshot") || lower.includes("screen shot") || steps.length === 0) {
    steps.push({
      id: "step_screenshot_initial",
      name: "Capture screenshot",
      action: { type: "screenshot", analyze: false },
      timeout: 5000,
    });
  }

  if (waitMs !== null) {
    steps.push({
      id: "step_wait",
      name: "Wait",
      action: { type: "wait", ms: waitMs },
      timeout: waitMs + 2000,
    });

    if (lower.includes("screenshot") || lower.includes("screen shot")) {
      steps.push({
        id: "step_screenshot_final",
        name: "Capture final screenshot",
        action: { type: "screenshot", analyze: false },
        timeout: 5000,
      });
    }
  }

  return steps;
}

/**
 * Execute a predefined automation workflow.
 */
export function executeWorkflowTool(ctx: ToolContext) {
  return {
    description:
      "Prepare a predefined desktop workflow for Rearvy Desktop to execute after user approval.",
    parameters: {
      type: "object" as const,
      properties: {
        templateId: {
          type: "string",
          description: `ID of the predefined template. Choose from: ${WORKFLOW_TEMPLATES.map((t) => t.id).join(", ")}`,
        },
        config: {
          type: "object",
          description: "Configuration parameters for the template.",
          properties: {},
          additionalProperties: true,
        },
      },
      required: ["templateId", "config"],
    },
    execute: async (params: { templateId: string; config: Record<string, unknown> }) => {
      try {
        if (!ctx.isDesktopApp) {
          return {
            type: "error",
            error: "Desktop automation requires the Rearvy desktop app.",
          };
        }

        const workflow = createWorkflowFromTemplate(params.templateId, ctx.userId, params.config);
        if (!workflow) {
          return {
            type: "error",
            error: `Template '${params.templateId}' not found. Available templates: ${WORKFLOW_TEMPLATES.map((t) => t.id).join(", ")}`,
          };
        }

        const payload = workflowFromTemplate(workflow, "template");

        return {
          type: "success",
          workflowId: payload.id,
          name: payload.name,
          status: "pending_approval",
          message: `Workflow "${payload.name}" is ready for desktop approval.`,
          steps: payload.steps.length,
          template: params.templateId,
          workflow: payload,
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
 * Prepare a custom workflow from model-provided steps.
 */
export function planWorkflowTool(ctx: ToolContext) {
  return {
    description:
      "Prepare a custom desktop OS workflow for the Electron app. Provide explicit safe steps using action types: screenshot, wait, launchApp, click, moveMouse, type, keyPress, setClipboard, getClipboard, scroll. The user must approve before execution.",
    parameters: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "What the workflow should do.",
        },
        name: {
          type: "string",
          description: "Short workflow name.",
        },
        steps: {
          type: "array",
          description:
            "Executable desktop steps. If omitted, Rearvy will build a conservative screenshot/wait/open fallback workflow from the description.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              action: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: Array.from(ALLOWED_ACTION_TYPES),
                  },
                },
                additionalProperties: true,
              },
              timeout: { type: "number" },
              retry: {
                type: "object",
                properties: {
                  max: { type: "number" },
                  backoffMs: { type: "number" },
                },
              },
            },
            required: ["name", "action"],
          },
        },
      },
      required: ["description"],
    },
    execute: async (params: {
      description: string;
      name?: string;
      steps?: DesktopWorkflowStepInput[];
    }) => {
      try {
        if (!ctx.isDesktopApp) {
          return {
            type: "error",
            error: "Workflow planning requires the Rearvy desktop app.",
          };
        }

        const steps = Array.isArray(params.steps) && params.steps.length > 0
          ? params.steps
          : createFallbackSteps(params.description);

        const workflow = createWorkflowPayload({
          id: makeWorkflowId("chat_workflow"),
          name: params.name || "Desktop Workflow",
          description: params.description,
          source: "chat-tool",
          steps,
        });

        return {
          type: "success",
          workflowId: workflow.id,
          name: workflow.name,
          status: "pending_approval",
          message: `Workflow "${workflow.name}" is ready for desktop approval.`,
          steps: workflow.steps.length,
          requiresApproval: true,
          workflow,
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
 * List available workflow templates.
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
            "Filter templates by category (trading, communication, files, reporting, automation, or all for no filter)",
        },
      },
    },
    execute: async (params: { category?: string }) => {
      try {
        const { category = "all" } = params;

        let templates = WORKFLOW_TEMPLATES;
        if (category !== "all" && category) {
          templates = templates.filter((template) => template.category === category);
        }

        return {
          type: "success",
          count: templates.length,
          templates: templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            configSchema: template.configSchema,
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
 * Get workflow execution status.
 */
export function getWorkflowStatusTool(_ctx: ToolContext) {
  return {
    description: "Check the status of a currently executing or recently completed desktop workflow",
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
        return {
          type: "success",
          workflowId: params.workflowId,
          message: "Workflow status is streamed in the Desktop Workspace side panel.",
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
 * Get desktop automation tools for tool registry.
 */
export async function getFLERBAITools(ctx: ToolContext) {
  return {
    executeWorkflow: executeWorkflowTool(ctx),
    planWorkflow: planWorkflowTool(ctx),
    listWorkflowTemplates: listWorkflowTemplatesTool(ctx),
    getWorkflowStatus: getWorkflowStatusTool(ctx),
  };
}
