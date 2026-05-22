/**
 * FLERB AI - Phase 5: Novel Workflow Planning
 * AI-driven workflow generation from natural language requests
 */

import { Workflow, WorkflowStep, DesktopAction } from "./types";

type ReactRuntime = typeof import("react");

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
      const Anthropic = await import("@anthropic-ai/sdk");
      const client = new Anthropic.default({ apiKey: this.anthropicApiKey });

      const message = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `User request: "${userRequest}"

Generate a detailed workflow plan in JSON format.`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response format");
      }

      return content.text;
    } catch (err) {
      throw new Error(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Parse Claude response into WorkflowPlan
   */
  private parseResponse(response: string, userId: string): WorkflowPlan {
    try {
      // Extract JSON from response (Claude may wrap it in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and transform
      const steps: WorkflowStep[] = (parsed.steps || []).map((step: any, idx: number) => ({
        id: step.id || `step_${idx + 1}`,
        name: step.name || "Unknown",
        description: step.description,
        action: step.action,
        dependsOn: step.dependsOn || [],
        timeout: step.timeout || 10000,
        retry: step.retry || { max: 1, backoffMs: 1000 },
        optional: step.optional || false,
      }));

      const plan: WorkflowPlan = {
        workflowId: `novel_${Date.now()}`,
        name: parsed.name || "Custom Workflow",
        description: parsed.description || "",
        steps,
        reasoning: parsed.reasoning || "",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        requiresApproval: parsed.requiresApproval !== false,
      };

      return plan;
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
    const action = step.action as DesktopAction;
    if (isDangerousAction(action)) {
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
function isDangerousAction(action: any): boolean {
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

  const actionStr = JSON.stringify(action).toLowerCase();
  return dangerousPatterns.some((pattern) => actionStr.includes(pattern));
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
  const prompt = `
Original workflow:
${JSON.stringify(originalPlan, null, 2)}

User feedback:
Issue: ${feedback.issue}
${feedback.suggestion ? `Suggestion: ${feedback.suggestion}` : ""}

Please refine the workflow plan to address this issue. Return updated JSON workflow.
`;

  // This would call Claude to refine, for now return original
  console.log("Refinement request:", feedback);
  return originalPlan;
}

// ============================================================================
// React Component: Workflow Planner UI
// ============================================================================

export function WorkflowPlannerUI({
  onPlanCreated,
  isLoading = false,
}: {
  onPlanCreated: (plan: WorkflowPlan) => Promise<void>;
  isLoading?: boolean;
}) {
  const React = getReactRuntime();
  const [request, setRequest] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError(null);

    if (!request.trim()) {
      setError("Please describe what you want to automate");
      return;
    }

    try {
      // In real implementation, this would call the planner API
      console.log("Planning workflow for:", request);
      // await onPlanCreated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-3">Create Automation</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={request}
          onChange={(e: any) => setRequest(e.target.value)}
          placeholder="Describe what you want to automate... (e.g., 'Open a notepad and type a greeting')"
          className="w-full bg-slate-800 text-white p-3 rounded border border-slate-600 focus:border-blue-500 resize-none h-24"
          disabled={isLoading}
        />

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded font-medium"
        >
          {isLoading ? "Planning..." : "Plan Workflow"}
        </button>
      </form>

      <p className="text-xs text-slate-400 mt-3">
        Describe your automation task in plain English. FLERB AI will create a workflow plan and ask for approval before
        running.
      </p>
    </div>
  );
}
