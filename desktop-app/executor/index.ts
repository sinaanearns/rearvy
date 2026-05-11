/**
 * Electron Main Process Executor
 * Runs in the Electron main thread and spawns WorkflowExecutor
 * Communicates with renderer via IPC
 */

import { WorkflowExecutor, createSimpleWorkflow } from "../../website/src/lib/ai/desktop-control";
import { Workflow, WorkflowState } from "../../website/src/lib/ai/desktop-control";

/**
 * DesktopExecutor manages workflow execution in the main process
 * One instance per user session
 */
export class DesktopExecutor {
  private currentWorkflow: WorkflowExecutor | null = null;
  private workflowHistory: Map<string, WorkflowState> = new Map();
  private claudeApiKey: string;
  private userId: string;
  private sendToRenderer: (channel: string, data: any) => void;

  constructor(userId: string, claudeApiKey: string, sendToRenderer: (channel: string, data: any) => void) {
    this.userId = userId;
    this.claudeApiKey = claudeApiKey;
    this.sendToRenderer = sendToRenderer;
  }

  /**
   * Start a new workflow execution
   */
  async startWorkflow(workflow: Workflow): Promise<void> {
    if (this.currentWorkflow) {
      throw new Error("Workflow already running");
    }

    console.log(`[DesktopExecutor] Starting workflow: ${workflow.id}`);

    this.currentWorkflow = new WorkflowExecutor(workflow, this.claudeApiKey);

    // Listen to state changes and send to renderer
    this.currentWorkflow.setStateChangeCallback(async (state: WorkflowState) => {
      this.workflowHistory.set(state.workflowId, state);
      this.sendToRenderer("workflow:state-change", state);
    });

    // Run in background
    this.currentWorkflow.start().finally(() => {
      const finalState = this.currentWorkflow?.getState();
      console.log(`[DesktopExecutor] Workflow completed:`, finalState);
      this.currentWorkflow = null;
    });
  }

  /**
   * Get current workflow state
   */
  getCurrentState(): WorkflowState | null {
    return this.currentWorkflow?.getState() ?? null;
  }

  /**
   * Pause current workflow
   */
  pauseWorkflow(): void {
    if (this.currentWorkflow) {
      this.currentWorkflow.pause();
      this.sendToRenderer("workflow:paused", {});
    }
  }

  /**
   * Resume current workflow
   */
  async resumeWorkflow(): Promise<void> {
    if (this.currentWorkflow) {
      await this.currentWorkflow.resume();
      this.sendToRenderer("workflow:resumed", {});
    }
  }

  /**
   * Stop current workflow
   */
  stopWorkflow(): void {
    if (this.currentWorkflow) {
      this.currentWorkflow.stop();
      this.sendToRenderer("workflow:stopped", {});
    }
  }

  /**
   * Get workflow history
   */
  getWorkflowHistory(workflowId?: string): WorkflowState[] {
    if (workflowId) {
      const state = this.workflowHistory.get(workflowId);
      return state ? [state] : [];
    }

    return Array.from(this.workflowHistory.values());
  }

  /**
   * Run a simple test workflow (for development)
   */
  async runTestWorkflow(): Promise<void> {
    const workflow = createSimpleWorkflow(this.userId);
    await this.startWorkflow(workflow);
  }
}

/**
 * Set up IPC handlers in the main process
 * Call this from preload.cjs or main.cjs
 */
export function setupDesktopExecutorIPC(ipcMain: any, executor: DesktopExecutor): void {
  console.log("[DesktopExecutor] Setting up IPC handlers");

  // Start workflow
  ipcMain.handle("desktop:start-workflow", async (event: any, workflow: Workflow) => {
    try {
      await executor.startWorkflow(workflow);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Get current state
  ipcMain.handle("desktop:get-state", async () => {
    return executor.getCurrentState();
  });

  // Pause workflow
  ipcMain.handle("desktop:pause", async () => {
    executor.pauseWorkflow();
    return { success: true };
  });

  // Resume workflow
  ipcMain.handle("desktop:resume", async () => {
    try {
      await executor.resumeWorkflow();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Stop workflow
  ipcMain.handle("desktop:stop", async () => {
    executor.stopWorkflow();
    return { success: true };
  });

  // Get history
  ipcMain.handle("desktop:get-history", async (event: any, workflowId?: string) => {
    return executor.getWorkflowHistory(workflowId);
  });

  // Test endpoint
  ipcMain.handle("desktop:test", async () => {
    try {
      await executor.runTestWorkflow();
      return { success: true, message: "Test workflow started" };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
