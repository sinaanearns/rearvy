/**
 * FLERB AI - Phase 2: Execution Runtime & Approval System
 * Real-time workflow state streaming, approval gates, guardrails
 */

import type { ChangeEvent, ComponentType } from "react";
import { createServerLogger } from "@/lib/server-logger";
import type { ApprovalCheckpoint, ScreenPerception, Workflow, WorkflowState } from "./types";

const log = createServerLogger("ExecutionRuntime");

type ReactRuntime = typeof import("react");
type NextImageComponent = ComponentType<{
  src: string;
  alt: string;
  width: number;
  height: number;
  unoptimized?: boolean;
  className?: string;
}>;
type FirestoreCollection = {
  doc: (id: string) => {
    collection: (name: string) => FirestoreCollection;
    set: (value: unknown, options?: { merge?: boolean }) => Promise<unknown>;
  };
  add: (value: unknown) => Promise<unknown>;
};
type FirestoreClient = {
  collection: (name: string) => FirestoreCollection;
};

function getReactRuntime() {
  const runtimeRequire = eval("require") as (name: string) => ReactRuntime;
  return runtimeRequire("react");
}

function getNextImage() {
  const runtimeRequire = eval("require") as (name: string) => { default: NextImageComponent };
  return runtimeRequire("next/image").default;
}

// ============================================================================
// Execution Context (with Firestore integration)
// ============================================================================

export interface ExecutionContext {
  workflowId: string;
  userId: string;
  state: WorkflowState;
  approvalsPending: Map<string, ApprovalCheckpoint>;
  stateSubscribers: ((state: WorkflowState) => void)[];
}

/**
 * ExecutionRuntime manages real-time workflow execution
 * Handles streaming state updates, approval gates, guardrails
 */
export class ExecutionRuntime {
  private contexts: Map<string, ExecutionContext> = new Map();
  private firestoreClient?: FirestoreClient;
  private dangerousOps = new Set([
    "deleteFile",
    "deleteFolder",
    "modifyRegistry",
    "installSoftware",
    "uninstallSoftware",
    "formatDrive",
    "systemShutdown",
  ]);

  private rateLimiter = {
    actionCounts: new Map<string, number>(), // userId -> action count
    windowStart: new Map<string, number>(), // userId -> window start time
    maxActionsPerHour: 100,
    rateLimitDelay: 50, // ms between actions
  };

  constructor(firestoreClient?: FirestoreClient) {
    this.firestoreClient = firestoreClient;
  }

  /**
   * Create execution context for a workflow
   */
  createContext(workflow: Workflow): ExecutionContext {
    const context: ExecutionContext = {
      workflowId: workflow.id,
      userId: workflow.userId,
      state: {
        workflowId: workflow.id,
        completedSteps: [],
        state: "pending-approval",
        logs: [],
        errorCount: 0,
        updatedAt: new Date().toISOString(),
      },
      approvalsPending: new Map(),
      stateSubscribers: [],
    };

    this.contexts.set(workflow.id, context);
    return context;
  }

  /**
   * Subscribe to workflow state changes
   */
  subscribeToState(
    workflowId: string,
    callback: (state: WorkflowState) => void
  ): () => void {
    const context = this.contexts.get(workflowId);
    if (context) {
      context.stateSubscribers.push(callback);
      // Return unsubscribe function
      return () => {
        const idx = context.stateSubscribers.indexOf(callback);
        if (idx !== -1) {
          context.stateSubscribers.splice(idx, 1);
        }
      };
    }

    return () => {
      /* noop */
    };
  }

  /**
   * Update workflow state and broadcast to subscribers
   */
  async updateState(workflowId: string, newState: Partial<WorkflowState>): Promise<void> {
    const context = this.contexts.get(workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow ${workflowId}`);
    }

    // Update state
    context.state = { ...context.state, ...newState, updatedAt: new Date().toISOString() };

    // Persist to Firestore if available
    if (this.firestoreClient) {
      try {
        await this.firestoreClient.collection("users").doc(context.userId)
          .collection("execution_state").doc(workflowId).set(context.state, { merge: true });
      } catch (err) {
        log.warn("Failed to persist state to Firestore:", err);
      }
    }

    // Notify subscribers
    for (const subscriber of context.stateSubscribers) {
      try {
        subscriber(context.state);
      } catch (err) {
        log.error("Subscriber error:", err);
      }
    }
  }

  /**
   * Check if action requires approval (dangerous ops)
   */
  isDangerousOperation(actionType: string): boolean {
    return this.dangerousOps.has(actionType);
  }

  /**
   * Check rate limits for user
   */
  checkRateLimit(userId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const windowStart = this.rateLimiter.windowStart.get(userId) || now;
    const windowElapsed = now - windowStart;
    const ONE_HOUR = 3600000;

    // Reset window if hour has passed
    if (windowElapsed > ONE_HOUR) {
      this.rateLimiter.actionCounts.set(userId, 0);
      this.rateLimiter.windowStart.set(userId, now);
      return { allowed: true };
    }

    // Check limit
    const actionCount = this.rateLimiter.actionCounts.get(userId) || 0;
    if (actionCount >= this.rateLimiter.maxActionsPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${actionCount}/${this.rateLimiter.maxActionsPerHour} actions this hour`,
      };
    }

    // Increment counter
    this.rateLimiter.actionCounts.set(userId, actionCount + 1);
    return { allowed: true };
  }

  /**
   * Request approval for action (dangerous or novel workflows)
   */
  requestApproval(
    workflowId: string,
    stepId: string,
    reason: string,
    preview: ScreenPerception
  ): ApprovalCheckpoint {
    const context = this.contexts.get(workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow ${workflowId}`);
    }

    const approval: ApprovalCheckpoint = {
      stepId,
      reason,
      preview: {
        screenshot: preview.screenshot.toString("base64"),
        description: `${reason} - Active window: ${preview.activeWindow}`,
      },
      requiresApproval: true,
    };

    context.approvalsPending.set(stepId, approval);
    return approval;
  }

  /**
   * Get pending approvals for workflow
   */
  getPendingApprovals(workflowId: string): ApprovalCheckpoint[] {
    const context = this.contexts.get(workflowId);
    if (!context) {
      return [];
    }

    return Array.from(context.approvalsPending.values());
  }

  /**
   * Approve a pending step
   */
  async approveStep(workflowId: string, stepId: string): Promise<void> {
    const context = this.contexts.get(workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow ${workflowId}`);
    }

    context.approvalsPending.delete(stepId);

    // Persist approval in Firestore
    if (this.firestoreClient) {
      try {
        await this.firestoreClient.collection("users").doc(context.userId)
          .collection("execution_approvals").add({
            workflowId,
            stepId,
            approvedAt: new Date().toISOString(),
            approvedBy: context.userId,
          });
      } catch (err) {
        log.warn("Failed to persist approval:", err);
      }
    }
  }

  /**
   * Reject a pending step
   */
  async rejectStep(workflowId: string, stepId: string, reason: string): Promise<void> {
    const context = this.contexts.get(workflowId);
    if (!context) {
      throw new Error(`Context not found for workflow ${workflowId}`);
    }

    context.approvalsPending.delete(stepId);

    // Update state to rejected
    await this.updateState(workflowId, {
      state: "failed",
      errorCount: context.state.errorCount + 1,
    });

    // Persist rejection in Firestore
    if (this.firestoreClient) {
      try {
        await this.firestoreClient.collection("users").doc(context.userId)
          .collection("execution_rejections").add({
            workflowId,
            stepId,
            reason,
            rejectedAt: new Date().toISOString(),
            rejectedBy: context.userId,
          });
      } catch (err) {
        log.warn("Failed to persist rejection:", err);
      }
    }
  }

  /**
   * Add guardrail checks before executing action
   */
  async validateAction(userId: string, actionType: string, params: Record<string, unknown>): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    // Check rate limit
    const rateLimit = this.checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { valid: false, reason: rateLimit.reason };
    }

    // Check for dangerous operations
    if (this.isDangerousOperation(actionType)) {
      return {
        valid: false,
        reason: `Action '${actionType}' requires explicit approval`,
      };
    }

    // Validate action-specific parameters
    if (actionType === "type" && typeof params.text === "string") {
      if (params.text.length > 10000) {
        return { valid: false, reason: "Text too long (max 10000 chars)" };
      }
    }

    if (actionType === "click") {
      const { x, y } = params;
      if (typeof x !== "number" || typeof y !== "number") {
        return { valid: false, reason: "Invalid click coordinates" };
      }
      if (x < 0 || y < 0 || x > 3840 || y > 2160) {
        return { valid: false, reason: "Click coordinates out of screen bounds" };
      }
    }

    return { valid: true };
  }

  /**
   * Get context for workflow
   */
  getContext(workflowId: string): ExecutionContext | undefined {
    return this.contexts.get(workflowId);
  }

  /**
   * Cleanup context on workflow completion
   */
  cleanupContext(workflowId: string): void {
    this.contexts.delete(workflowId);
  }
}

// ============================================================================
// Approval UI Component (React)
// ============================================================================

/**
 * React component for approval UI
 * Shows pending approvals with preview screenshots and approve/reject buttons
 */
export function ApprovalDialog({
  workflowId,
  stepId,
  checkpoint,
  onApprove,
  onReject,
  isLoading = false,
}: {
  workflowId: string;
  stepId: string;
  checkpoint: ApprovalCheckpoint;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  isLoading?: boolean;
}) {
  const React = getReactRuntime();
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isRejecting, setIsRejecting] = React.useState(false);

  const handleApprove = async () => {
    try {
      await onApprove();
    } catch (err) {
      log.error("Approval failed:", err);
    }
  };

  const handleReject = async () => {
    try {
      setIsRejecting(true);
      await onReject(rejectionReason || "Rejected by user");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-2">Approval Required</h2>

        <div className="bg-slate-800 rounded p-3 mb-4">
          <p className="text-yellow-300 text-sm font-mono">{checkpoint.reason}</p>
        </div>

        {checkpoint.preview.screenshot && (
          <div className="mb-4">
            <p className="text-slate-300 text-sm mb-2">Preview:</p>
            {(() => {
              const Image = getNextImage();
              return (
                <Image
              src={`data:image/png;base64,${checkpoint.preview.screenshot}`}
              alt="Screen preview"
                  width={960}
                  height={540}
                  unoptimized
              className="w-full rounded border border-slate-700 max-h-64 object-contain"
                />
              );
            })()}
          </div>
        )}

        <div className="bg-slate-800 rounded p-3 mb-4">
          <p className="text-slate-400 text-xs">{checkpoint.preview.description}</p>
        </div>

        {isRejecting && (
          <textarea
            value={rejectionReason}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(event.target.value)}
            placeholder="Why are you rejecting this? (optional)"
            className="w-full bg-slate-700 text-white p-2 rounded text-sm mb-4 resize-none h-20"
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded font-medium"
          >
            {isLoading ? "Processing..." : "Approve"}
          </button>

          <button
            onClick={() => setIsRejecting(!isRejecting)}
            className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded font-medium"
          >
            {isRejecting ? "Confirm Reject" : "Reject"}
          </button>

          {isRejecting && (
            <button
              onClick={() => {
                setIsRejecting(false);
                setRejectionReason("");
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Execution Monitor Component (React)
// ============================================================================

export function ExecutionMonitor({
  state,
  onPause,
  onResume,
  onStop,
}: {
  state: WorkflowState;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const React = getReactRuntime();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      setIsLoading(true);
      await action();
    } finally {
      setIsLoading(false);
    }
  };

  const progress = state.completedSteps.length;
  const total = 100; // Placeholder

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-900 border border-slate-700 rounded-lg p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Execution</h3>
        <span
          className={`px-2 py-1 rounded text-xs font-mono ${
            state.state === "running"
              ? "bg-green-900 text-green-300"
              : state.state === "paused"
                ? "bg-yellow-900 text-yellow-300"
                : "bg-red-900 text-red-300"
          }`}
        >
          {state.state}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Progress</span>
          <span>{progress}/{total}</span>
        </div>
        <div className="h-2 bg-slate-700 rounded overflow-hidden">
          <div className="h-full bg-green-600" style={{ width: `${(progress / total) * 100}%` }} />
        </div>
      </div>

      <div className="text-xs text-slate-400 mb-3">Errors: {state.errorCount}</div>

      <div className="flex gap-2">
        {state.state === "running" ? (
          <>
            <button
              onClick={() => handleAction(onPause)}
              disabled={isLoading}
              className="flex-1 px-2 py-1 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 rounded text-xs"
            >
              Pause
            </button>
            <button
              onClick={() => handleAction(onStop)}
              disabled={isLoading}
              className="flex-1 px-2 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded text-xs font-bold"
            >
              STOP
            </button>
          </>
        ) : (
          <button
            onClick={() => handleAction(onResume)}
            disabled={isLoading}
            className="flex-1 px-2 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-xs"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
