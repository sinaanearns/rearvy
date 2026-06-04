"use client";

/**
 * React Hook for Desktop Automation
 * Client-side interface to communicate with DesktopExecutor via IPC
 */

import { useState, useCallback, useEffect } from "react";
import { createClientLogger } from "@/lib/client-diagnostics";
import type { Workflow, WorkflowState } from "@/lib/ai/desktop-control";

const log = createClientLogger("DesktopExecutor");

type AutomationBridge = NonNullable<NonNullable<Window["electron"]>["automation"]>;

type FailedAutomationResult = {
  success?: false;
  ok?: false;
  error?: unknown;
  reason?: unknown;
};

const WORKFLOW_STATES = new Set<WorkflowState["state"]>([
  "draft",
  "pending-approval",
  "running",
  "paused",
  "completed",
  "failed",
  "stopped",
  "rejected",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function isFailedAutomationResult(result: unknown): result is FailedAutomationResult {
  return isRecord(result) && (result.success === false || result.ok === false);
}

export function getAutomationErrorMessage(result: FailedAutomationResult, fallback: string) {
  return typeof result.error === "string" && result.error.trim()
    ? result.error
    : typeof result.reason === "string" && result.reason.trim()
      ? result.reason
      : fallback;
}

export function isWorkflowState(value: unknown): value is WorkflowState {
  return (
    isRecord(value) &&
    typeof value.workflowId === "string" &&
    Array.isArray(value.completedSteps) &&
    typeof value.state === "string" &&
    WORKFLOW_STATES.has(value.state as WorkflowState["state"]) &&
    Array.isArray(value.logs) &&
    typeof value.errorCount === "number"
  );
}

export function getAutomationResultState(result: unknown): WorkflowState | null {
  if (!isRecord(result)) {
    return null;
  }

  return isWorkflowState(result.state) ? result.state : null;
}

export function coerceWorkflowHistory(value: unknown): WorkflowState[] {
  return Array.isArray(value) ? value.filter(isWorkflowState) : [];
}

/**
 * Hook to interact with desktop executor
 * Only works in Electron app
 */
export function useDesktopExecutor() {
  const [currentState, setCurrentState] = useState<WorkflowState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<WorkflowState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [bridgeToken, setBridgeToken] = useState(0);

  const getAutomation = useCallback((): AutomationBridge | null => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.electron?.automation ?? null;
  }, []);

  /**
   * Start a workflow
   */
  const startWorkflow = useCallback(
    async (workflow: Workflow) => {
      try {
        setError(null);
        const automation = getAutomation();
        if (!automation?.startWorkflow) {
          throw new Error("Desktop automation bridge is unavailable");
        }

        const result = await automation.startWorkflow(workflow);
        if (isFailedAutomationResult(result)) {
          throw new Error(getAutomationErrorMessage(result, "Unknown error"));
        }

        const nextState = getAutomationResultState(result);
        if (nextState) {
          setCurrentState(nextState);
        }
        setIsRunning(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        log.error("Failed to start workflow:", err);
      }
    },
    [getAutomation]
  );

  /**
   * Get current state
   */
  const getState = useCallback(async () => {
    const automation = getAutomation();
    if (!automation?.getState) return null;

    try {
      const state = await automation.getState();
      const nextState = isWorkflowState(state) ? state : null;
      setCurrentState(nextState);
      setIsRunning(nextState?.state === "running");
      return nextState;
    } catch (err) {
      log.error("Failed to get state:", err);
      return null;
    }
  }, [getAutomation]);

  /**
   * Pause workflow
   */
  const pause = useCallback(async () => {
    const automation = getAutomation();
    if (!automation?.pause) return;

    try {
      const result = await automation.pause();
      if (isFailedAutomationResult(result)) {
        throw new Error(getAutomationErrorMessage(result, "Failed to pause workflow"));
      }
      setIsRunning(false);
    } catch (err) {
      log.error("Failed to pause:", err);
    }
  }, [getAutomation]);

  /**
   * Resume workflow
   */
  const resume = useCallback(async () => {
    const automation = getAutomation();
    if (!automation?.resume) return;

    try {
      const result = await automation.resume();
      if (isFailedAutomationResult(result)) {
        throw new Error(getAutomationErrorMessage(result, "Failed to resume workflow"));
      }
      setIsRunning(true);
    } catch (err) {
      log.error("Failed to resume:", err);
    }
  }, [getAutomation]);

  /**
   * Stop workflow (STOP button)
   */
  const stop = useCallback(async () => {
    const automation = getAutomation();
    if (!automation?.stop) return;

    try {
      const result = await automation.stop();
      if (isFailedAutomationResult(result)) {
        throw new Error(getAutomationErrorMessage(result, "Failed to stop workflow"));
      }
      setIsRunning(false);
    } catch (err) {
      log.error("Failed to stop:", err);
    }
  }, [getAutomation]);

  /**
   * Get history
   */
  const getHistory = useCallback(
    async (workflowId?: string) => {
      const automation = getAutomation();
      if (!automation?.getHistory) return [];

      try {
        const result = await automation.getHistory(workflowId);
        const nextHistory = coerceWorkflowHistory(result);
        setHistory(nextHistory);
        return nextHistory;
      } catch (err) {
        log.error("Failed to get history:", err);
        return [];
      }
    },
    [getAutomation]
  );

  /**
   * Run test workflow
   */
  const runTest = useCallback(async () => {
    const automation = getAutomation();
    if (!automation?.runTest) {
      setError("Desktop automation bridge is unavailable");
      return;
    }

    try {
      setError(null);
      const result = await automation.runTest();

      if (isFailedAutomationResult(result)) {
        throw new Error(getAutomationErrorMessage(result, "Test failed"));
      }

      setIsRunning(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      log.error("Test failed:", err);
    }
  }, [getAutomation]);

  // Listen to state changes from the Electron preload automation bridge.
  useEffect(() => {
    const syncBridgeAvailability = () => {
      setIsElectron(Boolean(getAutomation()));
    };
    const handleBridgeReady = () => {
      syncBridgeAvailability();
      setBridgeToken((value) => value + 1);
    };

    const automation = getAutomation();
    syncBridgeAvailability();

    if (!automation) {
      if (typeof window !== "undefined") {
        window.addEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
        window.addEventListener("focus", syncBridgeAvailability);
      }

      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
          window.removeEventListener("focus", syncBridgeAvailability);
        }
      };
    }

    const handleStateChange = (state: unknown) => {
      if (!isWorkflowState(state)) {
        return;
      }

      const nextState = state;
      setCurrentState(nextState);
      setIsRunning(nextState?.state === "running");
    };

    const unsubscribeState = automation.onStateChange?.(handleStateChange);
    const unsubscribePaused = automation.onPaused?.(() => setIsRunning(false));
    const unsubscribeResumed = automation.onResumed?.(() => setIsRunning(true));
    const unsubscribeStopped = automation.onStopped?.(() => setIsRunning(false));

    void getState();

    if (typeof window !== "undefined") {
      window.addEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
      window.addEventListener("focus", syncBridgeAvailability);
    }

    return () => {
      unsubscribeState?.();
      unsubscribePaused?.();
      unsubscribeResumed?.();
      unsubscribeStopped?.();
      if (typeof window !== "undefined") {
        window.removeEventListener("rearvy-electron-ready", handleBridgeReady as EventListener);
        window.removeEventListener("focus", syncBridgeAvailability);
      }
    };
  }, [bridgeToken, getAutomation, getState]);

  return {
    currentState,
    isRunning,
    history,
    error,
    isElectron,
    // Methods
    startWorkflow,
    getState,
    pause,
    resume,
    stop,
    getHistory,
    runTest,
  };
}

/**
 * Component to display workflow execution status
 */
export function WorkflowStatusPanel() {
  const { currentState, isRunning, error, pause, resume, stop } = useDesktopExecutor();

  if (!currentState) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-900 border border-slate-700 rounded-lg p-4 text-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{currentState.workflowId}</h3>
        <span
          className={`px-2 py-1 rounded text-xs font-mono ${
            isRunning
              ? "bg-green-900 text-green-300"
              : currentState.state === "failed"
                ? "bg-red-900 text-red-300"
                : "bg-slate-700 text-slate-300"
          }`}
        >
          {currentState.state}
        </span>
      </div>

      <div className="text-xs text-slate-400 mb-3">
        Completed: {currentState.completedSteps.length} | Errors: {currentState.errorCount}
      </div>

      <div className="flex gap-2">
        {isRunning ? (
          <>
            <button
              onClick={pause}
              className="flex-1 px-2 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-xs"
            >
              Pause
            </button>
            <button onClick={stop} className="flex-1 px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs">
              STOP
            </button>
          </>
        ) : (
          <button
            onClick={resume}
            className="flex-1 px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs"
          >
            Resume
          </button>
        )}
      </div>

      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  );
}
