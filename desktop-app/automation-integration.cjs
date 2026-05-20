/**
 * Electron Automation Integration for FLERB AI
 * Sets up workflow automation state and IPC handlers.
 */

const { desktopCapturer } = require("electron");

let automationExecutor = null;
let mainWindow = null;

function createEmptyState(userId) {
  return {
    sessionId: `desktop_${Date.now()}`,
    workflowId: null,
    userId,
    task: null,
    currentStep: null,
    currentStepName: null,
    currentStepIndex: -1,
    totalSteps: 0,
    completedSteps: [],
    approvalPoints: [],
    state: "draft",
    logs: [],
    errorCount: 0,
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
    screenshotDataUrl: null,
  };
}

async function captureScreenDataUrl() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1280, height: 720 },
      fetchWindowIcons: false,
    });

    const source = sources[0];
    return source ? source.thumbnail.toDataURL() : null;
  } catch (error) {
    console.error("[Automation] Failed to capture screen:", error);
    return null;
  }
}

function initializeAutomation(window, userId) {
  mainWindow = window;

  try {
    automationExecutor = createMockExecutor(userId);
    console.log("[Automation] Executor initialized for user:", userId);
  } catch (err) {
    console.error("[Automation] Failed to initialize executor:", err);
  }
}

function createMockExecutor(userId) {
  const workflowHistory = new Map();

  const executor = {
    userId,
    currentWorkflow: null,
    currentStepIndex: -1,
    stepTimer: null,
    heartbeatTimer: null,
    screenshotDataUrl: null,
    workflowHistory,

    clearTimers() {
      if (this.stepTimer) {
        clearTimeout(this.stepTimer);
        this.stepTimer = null;
      }

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    },

    async refreshScreenshot() {
      this.screenshotDataUrl = await captureScreenDataUrl();
      return this.screenshotDataUrl;
    },

    snapshotWorkflow() {
      if (!this.currentWorkflow) {
        return null;
      }

      return {
        ...this.currentWorkflow,
        completedSteps: [...(this.currentWorkflow.completedSteps || [])],
        approvalPoints: [...(this.currentWorkflow.approvalPoints || [])],
        logs: [...(this.currentWorkflow.logs || [])],
      };
    },

    buildState() {
      if (!this.currentWorkflow) {
        return null;
      }

      const step = this.currentWorkflow.steps[this.currentStepIndex] || null;
      const nextStep = this.currentWorkflow.steps[this.currentStepIndex + 1] || null;

      return {
        sessionId: this.currentWorkflow.sessionId,
        workflowId: this.currentWorkflow.id,
        userId: this.currentWorkflow.userId,
        task: this.currentWorkflow.name,
        currentStep: step ? step.id : null,
        currentStepName: step ? step.name : null,
        currentStepIndex: this.currentStepIndex,
        nextStep: nextStep ? nextStep.id : null,
        nextStepName: nextStep ? nextStep.name : null,
        totalSteps: this.currentWorkflow.steps.length,
        completedSteps: [...(this.currentWorkflow.completedSteps || [])],
        approvalPoints: [...(this.currentWorkflow.approvalPoints || [])],
        state: this.currentWorkflow.state,
        logs: [...(this.currentWorkflow.logs || [])],
        errorCount: this.currentWorkflow.errorCount || 0,
        startedAt: this.currentWorkflow.startedAt || null,
        completedAt: this.currentWorkflow.completedAt || null,
        updatedAt: new Date().toISOString(),
        screenshotDataUrl: this.screenshotDataUrl,
      };
    },

    async notifyStateChange() {
      if (!mainWindow || !mainWindow.webContents || !this.currentWorkflow) {
        return;
      }

      this.currentWorkflow.updatedAt = new Date().toISOString();
      const state = this.buildState();
      if (!state) {
        return;
      }

      mainWindow.webContents.send("desktop:automation:state-change", state);
    },

    async startHeartbeat() {
      this.clearTimers();
      this.heartbeatTimer = setInterval(async () => {
        if (!this.currentWorkflow || this.currentWorkflow.state !== "running") {
          return;
        }

        await this.refreshScreenshot();
        await this.notifyStateChange();
      }, 2000);
    },

    async runStep(stepIndex) {
      if (!this.currentWorkflow || this.currentWorkflow.state !== "running") {
        return;
      }

      if (stepIndex >= this.currentWorkflow.steps.length) {
        this.currentWorkflow.state = "completed";
        this.currentWorkflow.completedAt = new Date().toISOString();
        await this.refreshScreenshot();
        await this.notifyStateChange();
        this.clearTimers();
        workflowHistory.set(this.currentWorkflow.id, this.snapshotWorkflow());
        return;
      }

      this.currentStepIndex = stepIndex;
      const step = this.currentWorkflow.steps[stepIndex];
      await this.refreshScreenshot();
      await this.notifyStateChange();

      this.stepTimer = setTimeout(async () => {
        if (!this.currentWorkflow || this.currentWorkflow.state !== "running") {
          return;
        }

        const log = {
          stepId: step.id,
          stepName: step.name,
          action: step.action?.type || "unknown",
          status: "success",
          durationMs: 900,
          startedAt: new Date(Date.now() - 900).toISOString(),
          completedAt: new Date().toISOString(),
          result: {
            note: `Completed ${step.name}`,
          },
        };

        this.currentWorkflow.logs = [...(this.currentWorkflow.logs || []), log];
        this.currentWorkflow.completedSteps = [
          ...(this.currentWorkflow.completedSteps || []),
          step.id,
        ];

        await this.refreshScreenshot();
        await this.notifyStateChange();
        await this.runStep(stepIndex + 1);
      }, 1100);
    },

    async startWorkflow(workflow) {
      console.log("[Automation] Starting workflow:", workflow.id);
      this.clearTimers();

      this.currentWorkflow = {
        ...createEmptyState(this.userId),
        ...workflow,
        id: workflow.id || `workflow_${Date.now()}`,
        userId: workflow.userId || this.userId,
        state:
          Array.isArray(workflow.approvalPoints) && workflow.approvalPoints.length > 0
            ? "pending-approval"
            : "running",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: Array.isArray(workflow.logs) ? [...workflow.logs] : [],
        completedSteps: Array.isArray(workflow.completedSteps) ? [...workflow.completedSteps] : [],
        approvalPoints: Array.isArray(workflow.approvalPoints) ? [...workflow.approvalPoints] : [],
      };

      this.currentStepIndex = -1;
      this.screenshotDataUrl = await captureScreenDataUrl();

      await this.notifyStateChange();

      if (this.currentWorkflow.state === "pending-approval") {
        workflowHistory.set(this.currentWorkflow.id, this.snapshotWorkflow());
        return { success: true, sessionId: this.currentWorkflow.sessionId, state: this.buildState() };
      }

      await this.startHeartbeat();
      await this.runStep(0);
      return { success: true, sessionId: this.currentWorkflow.sessionId, state: this.buildState() };
    },

    getState() {
      return this.buildState();
    },

    pause() {
      if (!this.currentWorkflow || this.currentWorkflow.state !== "running") {
        return;
      }

      this.currentWorkflow.state = "paused";
      this.clearTimers();
      void this.notifyStateChange();
    },

    async resume() {
      if (!this.currentWorkflow || this.currentWorkflow.state !== "paused") {
        return;
      }

      this.currentWorkflow.state = "running";
      await this.notifyStateChange();
      await this.startHeartbeat();
      await this.runStep(Math.max(0, this.currentStepIndex));
    },

    stop() {
      if (!this.currentWorkflow) {
        return;
      }

      this.currentWorkflow.state = "failed";
      this.currentWorkflow.completedAt = new Date().toISOString();
      this.clearTimers();
      void this.refreshScreenshot().finally(() => {
        void this.notifyStateChange();
        workflowHistory.set(this.currentWorkflow.id, this.snapshotWorkflow());
      });
    },

    getHistory(workflowId) {
      if (workflowId) {
        const state = workflowHistory.get(workflowId);
        return state ? [state] : [];
      }

      return Array.from(workflowHistory.values());
    },
  };

  return executor;
}

function setupAutomationIPC(ipcMain) {
  console.log("[Automation] Setting up IPC handlers");

  ipcMain.handle("desktop:automation:start-workflow", async (_event, workflow) => {
    try {
      if (!automationExecutor) {
        return { success: false, error: "Executor not initialized" };
      }

      return await automationExecutor.startWorkflow(workflow);
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle("desktop:automation:get-state", async () => {
    if (!automationExecutor) {
      return null;
    }
    return automationExecutor.getState();
  });

  ipcMain.handle("desktop:automation:pause", async () => {
    if (automationExecutor) {
      automationExecutor.pause();
    }
    return { success: true };
  });

  ipcMain.handle("desktop:automation:resume", async () => {
    if (automationExecutor) {
      await automationExecutor.resume();
    }
    return { success: true };
  });

  ipcMain.handle("desktop:automation:stop", async () => {
    if (automationExecutor) {
      automationExecutor.stop();
    }
    return { success: true };
  });

  ipcMain.handle("desktop:automation:get-history", async (_event, workflowId) => {
    if (!automationExecutor) {
      return [];
    }
    return automationExecutor.getHistory(workflowId);
  });

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

      return await automationExecutor.startWorkflow(testWorkflow);
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  });
}

function cleanupAutomation() {
  console.log("[Automation] Cleaning up");
  if (automationExecutor) {
    automationExecutor.clearTimers?.();
    automationExecutor.stop?.();
    automationExecutor = null;
  }
}

module.exports = {
  initializeAutomation,
  setupAutomationIPC,
  cleanupAutomation,
};
