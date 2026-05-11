/**
 * Electron Automation Integration for FLERB AI
 * Sets up DesktopExecutor and IPC handlers for workflow automation
 */

// For now, we're using simplified TypeScript imports
// In production, these would be compiled to JS

let automationExecutor = null;
let mainWindow = null;

/**
 * Initialize automation system
 * Called from main.cjs after window creation
 */
function initializeAutomation(window, userId, claudeApiKey) {
  mainWindow = window;

  try {
    // Dynamically import the executor (will be compiled to JS)
    // For now, we'll create a mock implementation
    automationExecutor = createMockExecutor(userId, claudeApiKey);
    console.log("[Automation] Executor initialized for user:", userId);
  } catch (err) {
    console.error("[Automation] Failed to initialize executor:", err);
  }
}

/**
 * Mock Executor for Phase 1 (will be replaced with real TypeScript version)
 */
function createMockExecutor(userId, claudeApiKey) {
  return {
    userId,
    currentWorkflow: null,
    workflowHistory: new Map(),

    async startWorkflow(workflow) {
      console.log("[Mock Executor] Starting workflow:", workflow.id);
      this.currentWorkflow = workflow;
      this.currentWorkflow.state = "running";
      this.currentWorkflow.startedAt = new Date().toISOString();

      // Simulate workflow execution
      this.simulateWorkflow(workflow);

      return { success: true };
    },

    simulateWorkflow(workflow) {
      let stepIndex = 0;

      const executeNextStep = () => {
        if (stepIndex >= workflow.steps.length || this.currentWorkflow.state === "failed") {
          this.currentWorkflow.state = "completed";
          this.currentWorkflow.completedAt = new Date().toISOString();
          this.workflowHistory.set(workflow.id, this.currentWorkflow);
          this.notifyStateChange();
          return;
        }

        const step = workflow.steps[stepIndex];
        console.log(`[Mock Executor] Executing step: ${step.name}`);

        setTimeout(() => {
          if (!this.currentWorkflow.logs) {
            this.currentWorkflow.logs = [];
          }

          this.currentWorkflow.logs.push({
            stepId: step.id,
            stepName: step.name,
            action: step.action.type,
            status: "success",
            durationMs: Math.random() * 2000,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          });

          if (!this.currentWorkflow.completedSteps) {
            this.currentWorkflow.completedSteps = [];
          }
          this.currentWorkflow.completedSteps.push(step.id);

          this.notifyStateChange();
          stepIndex++;
          executeNextStep();
        }, 1000);
      };

      executeNextStep();
    },

    getState() {
      if (!this.currentWorkflow) {
        return null;
      }

      return {
        workflowId: this.currentWorkflow.id,
        currentStep: this.currentWorkflow.steps[0]?.id,
        completedSteps: this.currentWorkflow.completedSteps || [],
        state: this.currentWorkflow.state,
        logs: this.currentWorkflow.logs || [],
        errorCount: 0,
        startedAt: this.currentWorkflow.startedAt,
        updatedAt: new Date().toISOString(),
      };
    },

    pause() {
      if (this.currentWorkflow && this.currentWorkflow.state === "running") {
        this.currentWorkflow.state = "paused";
        this.notifyStateChange();
      }
    },

    resume() {
      if (this.currentWorkflow && this.currentWorkflow.state === "paused") {
        this.currentWorkflow.state = "running";
        this.notifyStateChange();
        this.simulateWorkflow(this.currentWorkflow);
      }
    },

    stop() {
      if (this.currentWorkflow) {
        this.currentWorkflow.state = "failed";
        this.notifyStateChange();
      }
    },

    getHistory(workflowId) {
      if (workflowId) {
        const state = this.workflowHistory.get(workflowId);
        return state ? [state] : [];
      }
      return Array.from(this.workflowHistory.values());
    },

    notifyStateChange() {
      if (mainWindow && mainWindow.webContents) {
        const state = this.getState();
        if (state) {
          mainWindow.webContents.send("desktop:automation:state-change", state);
        }
      }
    },
  };
}

/**
 * Setup IPC handlers for automation
 * Call from main.cjs in app.whenReady()
 */
function setupAutomationIPC(ipcMain) {
  console.log("[Automation] Setting up IPC handlers");

  // Start workflow
  ipcMain.handle("desktop:automation:start-workflow", async (event, workflow) => {
    try {
      if (!automationExecutor) {
        return { success: false, error: "Executor not initialized" };
      }
      await automationExecutor.startWorkflow(workflow);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Get state
  ipcMain.handle("desktop:automation:get-state", async () => {
    if (!automationExecutor) {
      return null;
    }
    return automationExecutor.getState();
  });

  // Pause
  ipcMain.handle("desktop:automation:pause", async () => {
    if (automationExecutor) {
      automationExecutor.pause();
    }
    return { success: true };
  });

  // Resume
  ipcMain.handle("desktop:automation:resume", async () => {
    if (automationExecutor) {
      automationExecutor.resume();
    }
    return { success: true };
  });

  // Stop
  ipcMain.handle("desktop:automation:stop", async () => {
    if (automationExecutor) {
      automationExecutor.stop();
    }
    return { success: true };
  });

  // Get history
  ipcMain.handle("desktop:automation:get-history", async (event, workflowId) => {
    if (!automationExecutor) {
      return [];
    }
    return automationExecutor.getHistory(workflowId);
  });

  // Test
  ipcMain.handle("desktop:automation:test", async () => {
    try {
      if (!automationExecutor) {
        return { success: false, error: "Executor not initialized" };
      }

      const testWorkflow = {
        id: `test_${Date.now()}`,
        name: "Test Workflow",
        userId: automationExecutor.userId,
        type: "predefined",
        state: "draft",
        steps: [
          {
            id: "step_1",
            name: "Screenshot",
            action: { type: "screenshot", analyze: false },
            timeout: 5000,
          },
          {
            id: "step_2",
            name: "Wait",
            action: { type: "wait", ms: 2000 },
            timeout: 5000,
          },
          {
            id: "step_3",
            name: "Final Screenshot",
            action: { type: "screenshot", analyze: false },
            timeout: 5000,
            dependsOn: ["step_2"],
          },
        ],
        approvalPoints: [],
        createdAt: new Date().toISOString(),
        logs: [],
      };

      await automationExecutor.startWorkflow(testWorkflow);
      return { success: true, message: "Test workflow started" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

/**
 * Cleanup automation on app quit
 */
function cleanupAutomation() {
  console.log("[Automation] Cleaning up");
  if (automationExecutor) {
    automationExecutor.stop();
    automationExecutor = null;
  }
}

module.exports = {
  initializeAutomation,
  setupAutomationIPC,
  cleanupAutomation,
};
