/**
 * Electron Automation Integration for Rearvy Desktop.
 * Wires the preload IPC surface to the real OS workflow executor.
 */

const { WorkflowExecutor } = require("./lib/workflow-executor.cjs");
const { createLogger } = require("./lib/logger.cjs");

const log = createLogger("Automation");

let automationExecutor = null;
let mainWindow = null;

function initializeAutomation(window, userId) {
  mainWindow = window;

  try {
    if (automationExecutor) {
      automationExecutor.setMainWindow(window);
    } else {
      automationExecutor = new WorkflowExecutor({
        mainWindow: window,
        userId: userId || "default-user",
      });
    }

    log.info("Real workflow executor initialized for user:", userId || "default-user");
  } catch (error) {
    log.error("Failed to initialize executor:", error);
  }
}

function getExecutor() {
  return automationExecutor;
}

function setupAutomationIPC(ipcMain) {
  log.debug("Setting up IPC handlers");

  ipcMain.handle("desktop:automation:start-workflow", async (_event, workflow) => {
    try {
      const executor = getExecutor();
      if (!executor) {
        return { success: false, error: "Executor not initialized" };
      }

      return await executor.startWorkflow(workflow);
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("desktop:automation:approve-workflow", async (_event, workflowId) => {
    try {
      const executor = getExecutor();
      if (!executor) {
        return { success: false, error: "Executor not initialized" };
      }

      return await executor.approveWorkflow(workflowId);
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("desktop:automation:reject-workflow", async (_event, workflowId, reason) => {
    try {
      const executor = getExecutor();
      if (!executor) {
        return { success: false, error: "Executor not initialized" };
      }

      return await executor.rejectWorkflow(workflowId, reason);
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle("desktop:automation:get-state", async () => {
    const executor = getExecutor();
    return executor ? executor.getState() : null;
  });

  ipcMain.handle("desktop:automation:pause", async () => {
    const executor = getExecutor();
    if (executor) {
      executor.pause();
    }
    return { success: true };
  });

  ipcMain.handle("desktop:automation:resume", async () => {
    const executor = getExecutor();
    if (executor) {
      await executor.resume();
    }
    return { success: true };
  });

  ipcMain.handle("desktop:automation:stop", async () => {
    const executor = getExecutor();
    if (executor) {
      executor.stop();
    }
    return { success: true };
  });

  ipcMain.handle("desktop:automation:get-history", async (_event, workflowId) => {
    const executor = getExecutor();
    return executor ? executor.getHistory(workflowId) : [];
  });

  ipcMain.handle("desktop:automation:test", async () => {
    try {
      const executor = getExecutor();
      if (!executor) {
        return { success: false, error: "Executor not initialized" };
      }

      return await executor.startWorkflow({
        id: `test_${Date.now()}`,
        name: "Test Desktop Workflow",
        description: "Capture the screen, wait briefly, then capture it again.",
        source: "test",
        requiresApproval: true,
        steps: [
          {
            id: "step_1",
            name: "Initial screenshot",
            action: { type: "screenshot", analyze: false },
            timeout: 5000,
          },
          {
            id: "step_2",
            name: "Wait",
            action: { type: "wait", ms: 1000 },
            timeout: 3000,
          },
          {
            id: "step_3",
            name: "Final screenshot",
            action: { type: "screenshot", analyze: false },
            timeout: 5000,
          },
        ],
      });
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });
}

function cleanupAutomation() {
  log.debug("Cleaning up");
  if (automationExecutor) {
    automationExecutor.cleanup();
    automationExecutor = null;
  }
  mainWindow = null;
}

module.exports = {
  initializeAutomation,
  getExecutor,
  setupAutomationIPC,
  cleanupAutomation,
};
