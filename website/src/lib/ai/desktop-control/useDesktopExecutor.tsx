/**
 * React Hook for Desktop Automation
 * Client-side interface to communicate with DesktopExecutor via IPC
 */

import { useState, useCallback, useEffect } from "react";
import { Workflow, WorkflowState } from "@/lib/ai/desktop-control";

/**
 * Hook to interact with desktop executor
 * Only works in Electron app
 */
export function useDesktopExecutor() {
  const [currentState, setCurrentState] = useState<WorkflowState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<WorkflowState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isElectron = typeof window !== "undefined" && (window as any).electron?.ipcRenderer;

  const ipc = isElectron ? (window as any).electron.ipcRenderer : null;

  // Listen to state changes from main process
  useEffect(() => {
    if (!ipc) return;

    const handleStateChange = (state: WorkflowState) => {
      setCurrentState(state);
      setIsRunning(state.state === "running");
    };

    const handlePaused = () => {
      setIsRunning(false);
    };

    const handleResumed = () => {
      setIsRunning(true);
    };

    const handleStopped = () => {
      setIsRunning(false);
    };

    ipc.on("workflow:state-change", handleStateChange);
    ipc.on("workflow:paused", handlePaused);
    ipc.on("workflow:resumed", handleResumed);
    ipc.on("workflow:stopped", handleStopped);

    return () => {
      ipc.off("workflow:state-change", handleStateChange);
      ipc.off("workflow:paused", handlePaused);
      ipc.off("workflow:resumed", handleResumed);
      ipc.off("workflow:stopped", handleStopped);
    };
  }, [ipc]);

  /**
   * Start a workflow
   */
  const startWorkflow = useCallback(
    async (workflow: Workflow) => {
      if (!ipc) {
        setError("IPC not available - not running in Electron");
        return;
      }

      try {
        setError(null);
        const result = await ipc.invoke("desktop:start-workflow", workflow);

        if (!result.success) {
          throw new Error(result.error || "Unknown error");
        }

        setIsRunning(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        console.error("Failed to start workflow:", err);
      }
    },
    [ipc]
  );

  /**
   * Get current state
   */
  const getState = useCallback(async () => {
    if (!ipc) return null;

    try {
      const state = await ipc.invoke("desktop:get-state");
      setCurrentState(state);
      return state;
    } catch (err) {
      console.error("Failed to get state:", err);
      return null;
    }
  }, [ipc]);

  /**
   * Pause workflow
   */
  const pause = useCallback(async () => {
    if (!ipc) return;

    try {
      await ipc.invoke("desktop:pause");
      setIsRunning(false);
    } catch (err) {
      console.error("Failed to pause:", err);
    }
  }, [ipc]);

  /**
   * Resume workflow
   */
  const resume = useCallback(async () => {
    if (!ipc) return;

    try {
      await ipc.invoke("desktop:resume");
      setIsRunning(true);
    } catch (err) {
      console.error("Failed to resume:", err);
    }
  }, [ipc]);

  /**
   * Stop workflow (STOP button)
   */
  const stop = useCallback(async () => {
    if (!ipc) return;

    try {
      await ipc.invoke("desktop:stop");
      setIsRunning(false);
    } catch (err) {
      console.error("Failed to stop:", err);
    }
  }, [ipc]);

  /**
   * Get history
   */
  const getHistory = useCallback(
    async (workflowId?: string) => {
      if (!ipc) return [];

      try {
        const result = await ipc.invoke("desktop:get-history", workflowId);
        setHistory(result);
        return result;
      } catch (err) {
        console.error("Failed to get history:", err);
        return [];
      }
    },
    [ipc]
  );

  /**
   * Run test workflow
   */
  const runTest = useCallback(async () => {
    if (!ipc) {
      setError("IPC not available");
      return;
    }

    try {
      setError(null);
      const result = await ipc.invoke("desktop:test");

      if (!result.success) {
        throw new Error(result.error || "Test failed");
      }

      console.log(result.message);
      setIsRunning(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error("Test failed:", err);
    }
  }, [ipc]);

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
