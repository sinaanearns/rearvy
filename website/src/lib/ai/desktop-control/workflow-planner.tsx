/**
 * FLERB AI - Phase 5: Novel Workflow Planning
 * AI-driven workflow generation from natural language requests
 */

import type { ChangeEvent, FormEvent } from "react";

import { Workflow, WorkflowStep } from "./types";
import { parseJsonRecordFromText } from "@/lib/ai/json-object";

type ReactRuntime = typeof import("react");
type ParsedWorkflowObject = Record<string, unknown>;

function getReactRuntime() {
  const runtimeRequire = eval("require") as (name: string) => ReactRuntime;
  return runtimeRequire("react");
}

// ============================================================================
// Workflow Planner
// ============================================================================

export interface WorkflowPlan {
  workflowId: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  reasoning: string;
  confidence: number; // 0-1
  requiresApproval: boolean;
}

/**
 * WorkflowPlanner generates workflows from natural language descriptions
 */
export class WorkflowPlanner {
  private anthropicApiKey: string;

  constructor(anthropicApiKey: string) {
    this.anthropicApiKey = anthropicApiKey;
  }

  /**
   * Generate workflow plan from user request
   */
  async planWorkflow(userId: string, userRequest: string): Promise<WorkflowPlan> {
    // Build system prompt for Claude
    const systemPrompt = this.buildSystemPrompt();

    // Call Claude API to generate plan
    const response = await this.callClaude(systemPrompt, userRequest);

    // Parse response into WorkflowPlan
    const plan = this.parseResponse(response, userId);

    return plan;
  }

  /**
   * Regenerate an existing workflow plan with user feedback applied.
   */
  async refinePlan(originalPlan: WorkflowPlan, feedback: RefinementRequest): Promise<WorkflowPlan> {
    const prompt = `Refine this existing desktop automation workflow.

Original workflow:
${JSON.stringify(originalPlan, null, 2)}

Feedback:
- Issue: ${feedback.issue}
${feedback.suggestion ? `- Suggested fix: ${feedback.suggestion}` : ""}

Return the full updated workflow plan as JSON using the same response format.`;

    const response = await this.callClaude(this.buildSystemPrompt(), prompt);
    const refined = this.parseResponse(response, "refinement");
    const plan = {
      ...refined,
      workflowId: originalPlan.workflowId,
      requiresApproval: refined.requiresApproval || originalPlan.requiresApproval,
    };

    const validation = validateWorkflowPlan(plan);
    if (!validation.valid) {
      throw new Error(`Refined workflow is invalid: ${validation.errors.join("; ")}`);
    }

    return plan;
  }

  /**
   * Build system prompt for Claude
   */
  private buildSystemPrompt(): string {
    return `You are FLERB AI, an autonomous desktop automation system. Your job is to convert user requests into detailed, executable workflow plans.

# Available Desktop Actions

You can use these actions:
- click(x, y, button="left"): Click at screen coordinates
- type(text, delay=50): Type text with optional delay between characters
- keyPress(key, modifiers=[]): Press a key (e.g., "Enter", "Escape", "Control+c")
- moveMouse(x, y, duration=0): Move mouse to coordinates
- screenshot(analyze=true): Capture desktop screenshot with OCR/UI detection
- launchApp(appPath, args=[], wait=true): Launch an application
- closeWindow(windowTitle, force=false): Close a window
- setClipboard(text): Copy text to clipboard
- getClipboard(): Get clipboard contents
- wait(ms): Wait for specified milliseconds
- scroll(direction, amount): Scroll in a direction

# Guidelines

1. Break tasks into logical steps
2. Each step should be achievable with a single action
3. Add waits where necessary (e.g., after launching apps, before interacting with UI)
4. Use screenshots with analyze=true to detect UI elements
5. Specify dependencies between steps (dependsOn field)
6. Keep timeouts between 5000-30000ms
7. Add retries for network-dependent actions

# Response Format

Return a JSON object:
{
  "name": "Brief workflow name",
  "description": "What this workflow does",
  "steps": [
    {
      "id": "step_1",
      "name": "Step name",
      "description": "What this step does",
      "action": { "type": "action_type", ...params },
      "timeout": 5000,
      "retry": { "max": 1, "backoffMs": 1000 },
      "dependsOn": []
    }
  ],
  "reasoning": "Why you planned it this way",
  "confidence": 0.95,
  "requiresApproval": false
}

# Safety Rules

1. NEVER include actions that:
   - Delete files without confirmation
   - Modify system files
   - Change user permissions
   - Access sensitive data
   - Make financial transactions

2. For dangerous actions, set requiresApproval: true
3. Always validate file paths
4. Use relative paths when possible
5. Timeout should always be set

Generate workflow plans that are:
- Reliable: Actions have fallbacks and retries
- Safe: No destructive operations without approval
- Efficient: Minimal steps, parallel where possible
- Understandable: Clear step names and descriptions
`;
  }

  /**
   * Call Claude API to generate plan
   */
  private async callClaude(systemPrompt: string, userRequest: string): Promise<string> {
    try {
      const { aiCompletionService } = await import("@/lib/ai/model-router");
      const result = await aiCompletionService.generateText({
        task: "workflow_reasoning",
        requestedProviderModel:
          process.env.WORKFLOW_PLANNER_MODEL ||
          "qwen/qwen3-next-80b-a3b-instruct:free",
        maxOutputTokens: 2048,
        system: systemPrompt,
        prompt: `User request: "${userRequest}"

Generate a detailed workflow plan in JSON format.`,
        timeoutMs: 30_000,
      });

      if (result.aiUnavailable) {
        throw new Error("No routed AI provider is available for workflow planning.");
      }

      return result.text;
    } catch (err) {
      throw new Error(`Workflow planning AI call failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Parse Claude response into WorkflowPlan
   */
  private parseResponse(response: string, userId: string): WorkflowPlan {
    try {
      return parseWorkflowPlanResponse(response, userId);
    } catch (err) {
      throw new Error(`Failed to parse workflow plan: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ============================================================================
// Workflow Plan Validator
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateWorkflowPlan(plan: WorkflowPlan): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!plan.name) errors.push("Workflow must have a name");
  if (!plan.steps || plan.steps.length === 0) errors.push("Workflow must have at least one step");

  // Validate steps
  plan.steps.forEach((step, idx) => {
    if (!step.id) errors.push(`Step ${idx} missing id`);
    if (!step.name) errors.push(`Step ${idx} missing name`);
    if (!step.action) errors.push(`Step ${idx} missing action`);
    const timeout = step.timeout ?? 0;
    if (timeout < 1000) warnings.push(`Step ${idx} timeout too short`);
    if (timeout > 300000) warnings.push(`Step ${idx} timeout very long (>5min)`);

    // Check dependencies
    if (step.dependsOn) {
      step.dependsOn.forEach((depId) => {
        if (!plan.steps.find((s) => s.id === depId)) {
          errors.push(`Step ${idx} depends on non-existent step ${depId}`);
        }
      });
    }
  });

  // Check for cycles in dependencies
  if (hasCycle(plan.steps)) {
    errors.push("Workflow has circular dependencies");
  }

  // Check for dangerous operations
  plan.steps.forEach((step) => {
    if (isDangerousAction(step.action)) {
      if (!plan.requiresApproval) {
        warnings.push(`Step ${step.id} performs dangerous operation but approval not required`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if workflow has circular dependencies
 */
function hasCycle(steps: WorkflowStep[]): boolean {
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(stepId: string): boolean {
    if (visiting.has(stepId)) return true; // Cycle found
    if (visited.has(stepId)) return false; // Already visited

    visiting.add(stepId);

    const step = steps.find((s) => s.id === stepId);
    if (step && step.dependsOn) {
      for (const depId of step.dependsOn) {
        if (dfs(depId)) return true;
      }
    }

    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.id) && dfs(step.id)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if action is dangerous
 */
function isDangerousAction(action: unknown): boolean {
  const dangerousPatterns = [
    "delete",
    "remove",
    "uninstall",
    "format",
    "shutdown",
    "restart",
    "logout",
    "clear",
    "chmod",
    "chown",
  ];

  const actionStr = serializeForDangerScan(action);
  return dangerousPatterns.some((pattern) => actionStr.includes(pattern));
}

export function parseWorkflowPlanResponse(
  response: string,
  userId: string,
  timestamp = Date.now()
): WorkflowPlan {
  void userId;
  const parsed = parseJsonRecordFromText(response);
  if (!parsed) {
    throw new Error("No workflow plan JSON object found in response");
  }

  const workflow = parsed as ParsedWorkflowObject;
  const steps = parseWorkflowSteps(workflow.steps);

  return {
    workflowId: `novel_${timestamp}`,
    name: readString(workflow.name, "Custom Workflow"),
    description: readString(workflow.description, ""),
    steps,
    reasoning: readString(workflow.reasoning, ""),
    confidence: clampConfidence(readNumber(workflow.confidence, 0.8)),
    requiresApproval: workflow.requiresApproval !== false,
  };
}

function parseWorkflowSteps(value: unknown): WorkflowStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parseWorkflowStep);
}

function parseWorkflowStep(value: unknown, index: number): WorkflowStep {
  if (!isRecord(value)) {
    throw new Error(`Step ${index + 1} must be an object`);
  }

  return {
    id: readString(value.id, `step_${index + 1}`),
    name: readString(value.name, "Unknown"),
    description: readOptionalString(value.description),
    action: parseDesktopAction(value.action, index),
    dependsOn: readStringArray(value.dependsOn),
    timeout: readNumber(value.timeout, 10000),
    retry: parseRetry(value.retry),
    optional: value.optional === true,
  };
}

function parseDesktopAction(value: unknown, index: number): WorkflowStep["action"] {
  if (!isRecord(value) || typeof value.type !== "string" || !value.type.trim()) {
    throw new Error(`Step ${index + 1} must include an action with a type`);
  }

  switch (value.type) {
    case "click":
      return {
        type: "click",
        x: readRequiredNumber(value.x, `Step ${index + 1} click action requires x`),
        y: readRequiredNumber(value.y, `Step ${index + 1} click action requires y`),
        button: readMouseButton(value.button),
        double: value.double === true,
      };
    case "type":
      return {
        type: "type",
        text: readRequiredString(value.text, `Step ${index + 1} type action requires text`),
        delay: readOptionalNumber(value.delay),
      };
    case "keyPress":
      return {
        type: "keyPress",
        key: readRequiredString(value.key, `Step ${index + 1} keyPress action requires key`),
        modifiers: readKeyModifiers(value.modifiers),
      };
    case "moveMouse":
      return {
        type: "moveMouse",
        x: readRequiredNumber(value.x, `Step ${index + 1} moveMouse action requires x`),
        y: readRequiredNumber(value.y, `Step ${index + 1} moveMouse action requires y`),
        duration: readOptionalNumber(value.duration),
      };
    case "screenshot":
      return {
        type: "screenshot",
        analyze: value.analyze !== false,
      };
    case "launchApp":
      return {
        type: "launchApp",
        appPath: readRequiredString(value.appPath, `Step ${index + 1} launchApp action requires appPath`),
        args: readStringArray(value.args),
        wait: value.wait !== false,
      };
    case "closeWindow":
      return {
        type: "closeWindow",
        windowTitle: readOptionalString(value.windowTitle),
        force: value.force === true,
      };
    case "setClipboard":
      return {
        type: "setClipboard",
        text: readRequiredString(value.text, `Step ${index + 1} setClipboard action requires text`),
      };
    case "getClipboard":
      return { type: "getClipboard" };
    case "wait":
      return {
        type: "wait",
        ms: readRequiredNumber(value.ms, `Step ${index + 1} wait action requires ms`),
      };
    case "scroll":
      return {
        type: "scroll",
        direction: readScrollDirection(value.direction, index),
        amount: readRequiredNumber(value.amount, `Step ${index + 1} scroll action requires amount`),
      };
    default:
      throw new Error(`Step ${index + 1} uses unsupported action type: ${value.type}`);
  }
}

function parseRetry(value: unknown): WorkflowStep["retry"] {
  if (!isRecord(value)) {
    return { max: 1, backoffMs: 1000 };
  }

  return {
    max: readNumber(value.max, 1),
    backoffMs: readNumber(value.backoffMs, 1000),
  };
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readRequiredString(value: unknown, errorMessage: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(errorMessage);
  }

  return value;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readRequiredNumber(value: unknown, errorMessage: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(errorMessage);
  }

  return value;
}

function readMouseButton(value: unknown): "left" | "right" | "middle" | undefined {
  return value === "left" || value === "right" || value === "middle" ? value : undefined;
}

function readKeyModifiers(value: unknown): ("Control" | "Shift" | "Alt")[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((modifier): modifier is "Control" | "Shift" | "Alt" => {
    return modifier === "Control" || modifier === "Shift" || modifier === "Alt";
  });
}

function readScrollDirection(value: unknown, index: number): "up" | "down" | "left" | "right" {
  if (value === "up" || value === "down" || value === "left" || value === "right") {
    return value;
  }

  throw new Error(`Step ${index + 1} scroll action requires direction`);
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function serializeForDangerScan(value: unknown): string {
  try {
    return JSON.stringify(value)?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


// ============================================================================
// Refine Workflow Plan
// ============================================================================

export interface RefinementRequest {
  issue: string;
  suggestion?: string;
}

/**
 * Refine workflow plan based on feedback
 */
export async function refineWorkflowPlan(
  planner: WorkflowPlanner,
  originalPlan: WorkflowPlan,
  feedback: RefinementRequest
): Promise<WorkflowPlan> {
  return planner.refinePlan(originalPlan, feedback);
}

// ============================================================================
// React Component: Workflow Planner UI
// ============================================================================

export function WorkflowPlannerUI({
  onPlanCreated,
  planner,
  userId = "current-user",
  isLoading = false,
}: {
  onPlanCreated: (plan: WorkflowPlan) => Promise<void>;
  planner?: WorkflowPlanner;
  userId?: string;
  isLoading?: boolean;
}) {
  const React = getReactRuntime();
  const [request, setRequest] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPlanning, setIsPlanning] = React.useState(false);
  const disabled = isLoading || isPlanning;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!request.trim()) {
      setError("Please describe what you want to automate");
      return;
    }

    try {
      if (!planner) {
        throw new Error("Workflow planner is not configured");
      }

      setIsPlanning(true);
      const plan = await planner.planWorkflow(userId, request.trim());
      const validation = validateWorkflowPlan(plan);
      if (!validation.valid) {
        throw new Error(`Workflow plan is invalid: ${validation.errors.join("; ")}`);
      }

      await onPlanCreated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-3">Create Automation</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={request}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setRequest(event.target.value)}
          placeholder="Describe what you want to automate... (e.g., 'Open a notepad and type a greeting')"
          className="w-full bg-slate-800 text-white p-3 rounded border border-slate-600 focus:border-blue-500 resize-none h-24"
          disabled={disabled}
        />

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={disabled}
          className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded font-medium"
        >
          {disabled ? "Planning..." : "Plan Workflow"}
        </button>
      </form>

      <p className="text-xs text-slate-400 mt-3">
        Describe your automation task in plain English. FLERB AI will create a workflow plan and ask for approval before
        running.
      </p>
    </div>
  );
}
