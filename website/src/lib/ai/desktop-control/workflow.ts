/**
 * Workflow Engine - Orchestrates multi-step workflows
 * Handles: DAG execution, state management, approval gates
 */

import { Workflow, WorkflowStep, WorkflowState, ExecutionLog, DesktopAction, ToolCall, ActionResult } from "./types";
import { executeAction } from "./control";

export type WorkflowToolExecutor = (
  toolCall: ToolCall,
  context: {
    workflow: Workflow;
    step: WorkflowStep;
    state: WorkflowState;
    attempt: number;
  }
) => Promise<unknown>;

export interface WorkflowExecutorOptions {
  claudeApiKey?: string;
  toolExecutor?: WorkflowToolExecutor;
}

/**
 * WorkflowExecutor manages workflow execution
 */
export class WorkflowExecutor {
  private workflow: Workflow;
  private state: WorkflowState;
  private claudeApiKey?: string;
  private toolExecutor?: WorkflowToolExecutor;
  private onStateChange?: (newState: WorkflowState) => Promise<void>;
  private actionQueue: { stepId: string; action: DesktopAction }[] = [];
  private isRunning = false;

  constructor(
    workflow: Workflow,
    claudeApiKeyOrOptions?: string | WorkflowExecutorOptions,
    toolExecutor?: WorkflowToolExecutor
  ) {
    this.workflow = workflow;

    if (typeof claudeApiKeyOrOptions === "object" && claudeApiKeyOrOptions !== null) {
      this.claudeApiKey = claudeApiKeyOrOptions.claudeApiKey;
      this.toolExecutor = claudeApiKeyOrOptions.toolExecutor;
    } else {
      this.claudeApiKey = claudeApiKeyOrOptions;
      this.toolExecutor = toolExecutor;
    }

    this.state = {
      workflowId: workflow.id,
      completedSteps: [],
      state: "draft",
      logs: [],
      errorCount: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Set callback for state changes
   */
  setStateChangeCallback(callback: (state: WorkflowState) => Promise<void>): void {
    this.onStateChange = callback;
  }

  /**
   * Get current workflow state
   */
  getState(): WorkflowState {
    return { ...this.state };
  }

  /**
   * Start workflow execution
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("Workflow already running");
    }

    this.isRunning = true;
    this.state.state = "running";
    this.state.startedAt = new Date().toISOString();

    try {
      await this.executeDAG();
    } catch (err) {
      console.error("Workflow execution error:", err);
      this.state.state = "failed";
      this.state.errorCount++;
    } finally {
      this.isRunning = false;
      this.state.state = this.state.errorCount === 0 ? "completed" : "failed";
    }

    await this.persistState();
  }

  /**
   * Pause workflow execution
   */
  pause(): void {
    if (this.isRunning) {
      this.state.state = "paused";
    }
  }

  /**
   * Resume workflow execution
   */
  async resume(): Promise<void> {
    if (this.state.state === "paused") {
      this.state.state = "running";
      await this.start();
    }
  }

  /**
   * Stop workflow execution
   */
  stop(): void {
    this.isRunning = false;
    this.state.state = "failed";
  }

  /**
   * Execute workflow as DAG (directed acyclic graph)
   * @private
   */
  private async executeDAG(): Promise<void> {
    // Build dependency map
    const depMap = new Map<string, string[]>();
    const stepMap = new Map<string, WorkflowStep>();

    for (const step of this.workflow.steps) {
      stepMap.set(step.id, step);
      depMap.set(step.id, step.dependsOn || []);
    }

    // Topological sort to find execution order
    const execOrder = this.topologicalSort(depMap);

    console.log(`[Workflow] Execution order: ${execOrder.join(" → ")}`);

    // Execute steps in order
    for (const stepId of execOrder) {
      if (!this.isRunning) {
        break; // Stop if paused/stopped
      }

      const step = stepMap.get(stepId);
      if (!step) continue;

      // Check if dependencies completed
      const depsCompleted = (step.dependsOn || []).every((depId) => this.state.completedSteps.includes(depId));

      if (!depsCompleted) {
        console.warn(`[Workflow] Skipping ${stepId} - dependencies not met`);
        continue;
      }

      await this.executeStep(step);
    }
  }

  /**
   * Execute a single workflow step with retry logic
   * @private
   */
  private async executeStep(step: WorkflowStep): Promise<void> {
    const maxRetries = step.retry?.max ?? 1;
    const backoffMs = step.retry?.backoffMs ?? 1000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Workflow] Executing step ${step.id} (attempt ${attempt}/${maxRetries})`);

        const startTime = Date.now();

        const result =
          step.action.type === "tool"
            ? await this.executeToolCall(step.action, step, attempt)
            : await executeAction(step.action as DesktopAction, this.claudeApiKey);

        const durationMs = Date.now() - startTime;

        if (!result.success) {
          lastError = new Error(result.error || "Action failed");

          if (attempt < maxRetries) {
            console.warn(`[Workflow] Step ${step.id} failed, retrying in ${backoffMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
            continue;
          }

          throw lastError;
        }

        // Log successful step
        const log: ExecutionLog = {
          stepId: step.id,
          stepName: step.name,
          action: JSON.stringify(step.action),
          status: "success",
          durationMs,
          startedAt: new Date(Date.now() - durationMs).toISOString(),
          completedAt: new Date().toISOString(),
          result: result.output,
        };

        this.state.logs.push(log);
        this.state.completedSteps.push(step.id);
        this.state.lastAction = {
          timestamp: new Date().toISOString(),
          result,
        };

        console.log(`[Workflow] Step ${step.id} completed in ${durationMs}ms`);
        await this.persistState();
        return; // Success
      } catch (err) {
        lastError = err as Error;
        console.error(`[Workflow] Step ${step.id} attempt ${attempt} failed:`, lastError.message);
      }
    }

    // All retries failed
    if (lastError) {
      const log: ExecutionLog = {
        stepId: step.id,
        stepName: step.name,
        action: JSON.stringify(step.action),
        status: "failed",
        durationMs: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        errorMessage: lastError.message,
      };

      this.state.logs.push(log);
      this.state.errorCount++;

      if (!step.optional) {
        throw lastError;
      }

      console.warn(`[Workflow] Step ${step.id} failed but marked optional, continuing...`);
    }
  }

  /**
   * Execute a generic tool call step through the injected tool executor.
   * This keeps the workflow engine extensible without importing app/server tools here.
   */
  private async executeToolCall(toolCall: ToolCall, step: WorkflowStep, attempt: number): Promise<ActionResult> {
    const started = Date.now();

    if (!this.toolExecutor) {
      return {
        success: false,
        action: toolCall as unknown as DesktopAction,
        durationMs: Date.now() - started,
        error: `No tool executor registered for '${toolCall.toolName}'`,
      };
    }

    try {
      const output = await this.toolExecutor(toolCall, {
        workflow: this.workflow,
        step,
        state: this.getState(),
        attempt,
      });

      return {
        success: true,
        action: toolCall as unknown as DesktopAction,
        durationMs: Date.now() - started,
        output,
      };
    } catch (err) {
      return {
        success: false,
        action: toolCall as unknown as DesktopAction,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Topological sort for DAG
   * @private
   */
  private topologicalSort(depMap: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);

      const deps = depMap.get(node) || [];
      for (const dep of deps) {
        visit(dep);
      }

      result.push(node);
    };

    for (const node of depMap.keys()) {
      visit(node);
    }

    return result;
  }

  /**
   * Persist state to external storage (Firestore, etc.)
   * @private
   */
  private async persistState(): Promise<void> {
    this.state.updatedAt = new Date().toISOString();

    if (this.onStateChange) {
      await this.onStateChange(this.state);
    }

    // In real implementation, this would call Firestore/database
    console.log(`[Workflow] State persisted:`, {
      workflowId: this.state.workflowId,
      status: this.state.state,
      completedSteps: this.state.completedSteps.length,
      errors: this.state.errorCount,
    });
  }
}

/**
 * Create a simple predefined workflow for testing
 */
export function createSimpleWorkflow(userId: string): Workflow {
  return {
    id: `workflow_${Date.now()}`,
    name: "Simple Test Workflow",
    userId,
    type: "predefined",
    state: "draft",
    steps: [
      {
        id: "step_1",
        name: "Capture screenshot",
        description: "Take a screenshot to see current state",
        action: { type: "screenshot", analyze: true } as DesktopAction,
        timeout: 5000,
      },
      {
        id: "step_2",
        name: "Wait",
        description: "Wait 2 seconds",
        action: { type: "wait", ms: 2000 } as DesktopAction,
        timeout: 5000,
      },
      {
        id: "step_3",
        name: "Final screenshot",
        description: "Take final screenshot",
        action: { type: "screenshot", analyze: true } as DesktopAction,
        timeout: 5000,
        dependsOn: ["step_2"],
      },
    ],
    approvalPoints: [],
    createdAt: new Date().toISOString(),
    logs: [],
  };
}

/**
 * Create a trading monitor workflow template
 */
export function createTradingMonitorWorkflow(userId: string, symbol: string): Workflow {
  return {
    id: `trading_${Date.now()}`,
    name: `Monitor ${symbol}`,
    userId,
    type: "predefined",
    state: "draft",
    steps: [
      {
        id: "step_open_browser",
        name: "Open trading dashboard",
        action: { type: "launchApp", appPath: "chrome", args: ["https://rearvy.com/dashboard"] } as DesktopAction,
        timeout: 10000,
      },
      {
        id: "step_capture",
        name: "Capture market data",
        action: { type: "screenshot", analyze: true } as DesktopAction,
        timeout: 5000,
        dependsOn: ["step_open_browser"],
      },
    ],
    approvalPoints: [],
    createdAt: new Date().toISOString(),
    logs: [],
    metadata: { symbol },
  };
}
