/**
 * FLERB AI - Phase 6: Firestore Persistence & Audit Logging
 * Store workflows, executions, and audit trails for compliance
 */

import type { ChangeEvent } from "react";

import { createServerLogger } from "@/lib/server-logger";
import type { Workflow, WorkflowState, ExecutionLog } from "./types";

const persistenceLogger = createServerLogger("DesktopControlFirestore");

type ReactRuntime = typeof import("react");
type FirestoreWhereOperator = "==" | ">=" | "<=" | "<" | ">";
type ExportFormat = "json" | "csv";

interface FirestoreDocumentSnapshot<T> {
  exists: boolean;
  data(): T | undefined;
}

interface FirestoreQueryDocument<T> {
  data(): T;
  ref: {
    delete(): Promise<void>;
  };
}

interface FirestoreQuerySnapshot<T> {
  docs: FirestoreQueryDocument<T>[];
}

interface FirestoreQuery<T> {
  where(field: string, operator: FirestoreWhereOperator, value: unknown): FirestoreQuery<T>;
  orderBy(field: string, direction?: "asc" | "desc"): FirestoreQuery<T>;
  limit(limit: number): FirestoreQuery<T>;
  get(): Promise<FirestoreQuerySnapshot<T>>;
}

interface FirestoreDocumentReference<T> {
  collection(name: string): FirestoreCollectionReference<unknown>;
  doc(id?: string): FirestoreDocumentReference<T>;
  set(data: unknown, options?: unknown): Promise<void>;
  get(): Promise<FirestoreDocumentSnapshot<T>>;
}

interface FirestoreCollectionReference<T> extends FirestoreQuery<T> {
  doc(id?: string): FirestoreDocumentReference<T>;
  add(data: unknown): Promise<void>;
}

interface FirestoreClient {
  collection(name: string): FirestoreCollectionReference<unknown>;
}

type ExportExecutionLog = ExecutionLog & {
  workflowId?: string;
  timestamp?: string;
};

function getReactRuntime() {
  const runtimeRequire = eval("require") as (name: string) => ReactRuntime;
  return runtimeRequire("react");
}

function asQuery<T>(query: FirestoreQuery<unknown>): FirestoreQuery<T> {
  return query as FirestoreQuery<T>;
}

function asDocument<T>(document: FirestoreDocumentReference<unknown>): FirestoreDocumentReference<T> {
  return document as FirestoreDocumentReference<T>;
}

function normalizeExportFormat(value: string): ExportFormat {
  return value === "csv" ? "csv" : "json";
}

// ============================================================================
// Firestore Collections Schema
// ============================================================================

/**
 * Firestore collection structure for FLERB AI
 *
 * /users/{userId}/
 *   /workflows/              - Predefined workflow templates
 *   /trusted_workflows/      - User-approved workflow templates
 *   /agent_state/            - Current perception and execution state
 *   /execution_state/        - Per-workflow execution state
 *   /execution_logs/         - Complete execution audit trail
 *   /approvals_pending/      - Workflows awaiting user approval
 *   /execution_approvals/    - Record of approved workflows
 *   /execution_rejections/   - Record of rejected workflows
 *   /screenshots/            - Stored screenshot references
 */

// ============================================================================
// Firestore Adapter
// ============================================================================

export class FirestoreAdapter {
  private db: FirestoreClient;

  constructor(firestoreClient: FirestoreClient) {
    this.db = firestoreClient;
  }

  /**
   * Save workflow to Firestore
   */
  async saveWorkflow(userId: string, workflow: Workflow): Promise<void> {
    try {
      await this.db.collection("users").doc(userId)
        .collection("workflows").doc(workflow.id).set(workflow);
    } catch (err) {
      persistenceLogger.error("Failed to save workflow:", err);
      throw err;
    }
  }

  /**
   * Get workflow from Firestore
   */
  async getWorkflow(userId: string, workflowId: string): Promise<Workflow | null> {
    try {
      const doc = await this.db.collection("users").doc(userId)
        .collection("workflows").doc(workflowId).get();

      return doc.exists ? (doc.data() as Workflow) : null;
    } catch (err) {
      persistenceLogger.error("Failed to get workflow:", err);
      return null;
    }
  }

  /**
   * List workflows for user
   */
  async listWorkflows(userId: string, filter?: { type?: string; limit?: number }): Promise<Workflow[]> {
    try {
      let query = asQuery<Workflow>(this.db.collection("users").doc(userId).collection("workflows"));

      if (filter?.type) {
        query = query.where("type", "==", filter.type);
      }

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => doc.data());
    } catch (err) {
      persistenceLogger.error("Failed to list workflows:", err);
      return [];
    }
  }

  /**
   * Save execution state
   */
  async saveExecutionState(userId: string, state: WorkflowState): Promise<void> {
    try {
      await this.db.collection("users").doc(userId)
        .collection("execution_state").doc(state.workflowId).set(state, { merge: true });
    } catch (err) {
      persistenceLogger.error("Failed to save execution state:", err);
      throw err;
    }
  }

  /**
   * Get execution state
   */
  async getExecutionState(userId: string, workflowId: string): Promise<WorkflowState | null> {
    try {
      const doc = await asDocument<WorkflowState>(
        this.db.collection("users").doc(userId).collection("execution_state").doc(workflowId)
      ).get();

      return doc.exists ? (doc.data() as WorkflowState) : null;
    } catch (err) {
      persistenceLogger.error("Failed to get execution state:", err);
      return null;
    }
  }

  /**
   * Save execution log
   */
  async saveExecutionLog(userId: string, workflowId: string, log: ExecutionLog): Promise<void> {
    try {
      const docRef = this.db.collection("users").doc(userId)
        .collection("execution_logs").doc();

      await docRef.set({
        ...log,
        workflowId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      persistenceLogger.error("Failed to save execution log:", err);
      throw err;
    }
  }

  /**
   * Get execution history for workflow
   */
  async getExecutionHistory(
    userId: string,
    workflowId?: string,
    limit: number = 100
  ): Promise<ExecutionLog[]> {
    try {
      let query = asQuery<ExecutionLog>(this.db.collection("users").doc(userId).collection("execution_logs"));

      if (workflowId) {
        query = query.where("workflowId", "==", workflowId);
      }

      query = query.orderBy("timestamp", "desc").limit(limit);

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => doc.data());
    } catch (err) {
      persistenceLogger.error("Failed to get execution history:", err);
      return [];
    }
  }

  /**
   * Save approval record
   */
  async saveApprovalRecord(
    userId: string,
    workflowId: string,
    stepId: string,
    status: "approved" | "rejected",
    reason?: string
  ): Promise<void> {
    try {
      const collection = status === "approved" ? "execution_approvals" : "execution_rejections";

      await this.db.collection("users").doc(userId)
        .collection(collection).add({
          workflowId,
          stepId,
          status,
          reason,
          timestamp: new Date().toISOString(),
        });
    } catch (err) {
      persistenceLogger.error("Failed to save approval record:", err);
      throw err;
    }
  }

  /**
   * Mark workflow as trusted (auto-run future executions)
   */
  async trustWorkflow(userId: string, workflowId: string): Promise<void> {
    try {
      await this.db.collection("users").doc(userId)
        .collection("trusted_workflows").doc(workflowId).set({
          workflowId,
          trustedAt: new Date().toISOString(),
        });
    } catch (err) {
      persistenceLogger.error("Failed to trust workflow:", err);
      throw err;
    }
  }

  /**
   * Check if workflow is trusted
   */
  async isWorkflowTrusted(userId: string, workflowId: string): Promise<boolean> {
    try {
      const doc = await this.db.collection("users").doc(userId)
        .collection("trusted_workflows").doc(workflowId).get();

      return doc.exists;
    } catch (err) {
      persistenceLogger.error("Failed to check trust status:", err);
      return false;
    }
  }

  /**
   * Export execution logs for compliance
   */
  async exportExecutionLogs(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      format?: "json" | "csv";
    } = {}
  ): Promise<string> {
    try {
      const { startDate, endDate, format = "json" } = options;
      let query = asQuery<ExportExecutionLog>(this.db.collection("users").doc(userId).collection("execution_logs"));

      if (startDate) {
        query = query.where("timestamp", ">=", startDate.toISOString());
      }

      if (endDate) {
        query = query.where("timestamp", "<=", endDate.toISOString());
      }

      const snapshot = await query.orderBy("timestamp", "desc").get();
      const logs = snapshot.docs.map((doc) => doc.data());

      if (format === "csv") {
        return this.logsToCSV(logs);
      } else {
        return JSON.stringify(logs, null, 2);
      }
    } catch (err) {
      persistenceLogger.error("Failed to export logs:", err);
      throw err;
    }
  }

  /**
   * Convert logs to CSV format
   */
  private logsToCSV(logs: ExportExecutionLog[]): string {
    if (logs.length === 0) return "No logs";

    const headers = ["Timestamp", "Workflow ID", "Step ID", "Action", "Status", "Duration (ms)", "Error"];
    const rows = logs.map((log) => [
      log.timestamp,
      log.workflowId,
      log.stepId,
      log.action,
      log.status,
      log.durationMs,
      log.errorMessage || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    return csv;
  }

  /**
   * Clean up old execution logs (retention policy)
   */
  async cleanupOldLogs(userId: string, retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const query = this.db.collection("users").doc(userId)
        .collection("execution_logs")
        .where("timestamp", "<", cutoffDate.toISOString());

      const snapshot = await query.get();
      let deletedCount = 0;

      for (const doc of snapshot.docs) {
        await doc.ref.delete();
        deletedCount++;
      }

      return deletedCount;
    } catch (err) {
      persistenceLogger.error("Failed to cleanup old logs:", err);
      return 0;
    }
  }
}

// ============================================================================
// Audit Logger
// ============================================================================

export interface AuditEvent {
  timestamp: string;
  userId: string;
  eventType: "workflow_created" | "workflow_executed" | "workflow_approved" | "workflow_rejected" | "error";
  workflowId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogger {
  private db: FirestoreClient;

  constructor(firestoreClient: FirestoreClient) {
    this.db = firestoreClient;
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      await this.db.collection("audit_logs").add({
        ...event,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      persistenceLogger.error("Failed to log audit event:", err);
      throw err;
    }
  }

  /**
   * Get audit trail for user
   */
  async getUserAuditTrail(userId: string, limit: number = 100): Promise<AuditEvent[]> {
    try {
      const snapshot = await this.db.collection("audit_logs")
        .where("userId", "==", userId)
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => doc.data() as AuditEvent);
    } catch (err) {
      persistenceLogger.error("Failed to get audit trail:", err);
      return [];
    }
  }

  /**
   * Get audit trail for specific workflow
   */
  async getWorkflowAuditTrail(workflowId: string): Promise<AuditEvent[]> {
    try {
      const snapshot = await this.db.collection("audit_logs")
        .where("workflowId", "==", workflowId)
        .orderBy("timestamp", "asc")
        .get();

      return snapshot.docs.map((doc) => doc.data() as AuditEvent);
    } catch (err) {
      persistenceLogger.error("Failed to get workflow audit trail:", err);
      return [];
    }
  }
}

// ============================================================================
// React Component: Execution History
// ============================================================================

export function ExecutionHistory({
  logs,
  isLoading = false,
}: {
  logs: ExecutionLog[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <div className="text-slate-400">Loading...</div>;
  }

  if (logs.length === 0) {
    return <div className="text-slate-400 text-sm">No execution history</div>;
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {logs.map((log, idx) => (
        <div key={idx} className="bg-slate-800 rounded p-2 text-xs">
          <div className="flex justify-between items-start mb-1">
            <span className="font-mono font-semibold text-slate-300">{log.stepName}</span>
            <span
              className={`px-2 py-1 rounded text-xs ${
                log.status === "success"
                  ? "bg-green-900 text-green-300"
                  : log.status === "failed"
                    ? "bg-red-900 text-red-300"
                    : "bg-slate-700 text-slate-300"
              }`}
            >
              {log.status}
            </span>
          </div>

          <div className="text-slate-400 grid grid-cols-2 gap-2">
            <div>Duration: {log.durationMs}ms</div>
            <div>Started: {new Date(log.startedAt).toLocaleTimeString()}</div>
          </div>

          {log.errorMessage && <div className="text-red-400 mt-1">{log.errorMessage}</div>}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// React Component: Compliance Export
// ============================================================================

export function ComplianceExportUI({
  userId,
  onExport,
  isLoading = false,
}: {
  userId: string;
  onExport: (format: "json" | "csv") => Promise<string>;
  isLoading?: boolean;
}) {
  const React = getReactRuntime();
  const [format, setFormat] = React.useState<ExportFormat>("json");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const handleExport = async () => {
    try {
      const content = await onExport(format);
      const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_export_${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      persistenceLogger.error("Export failed:", err);
    }
  };

  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-3">Compliance Export</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Format</label>
          <select
            value={format}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormat(normalizeExportFormat(event.target.value))}
            className="w-full bg-slate-800 text-white p-2 rounded border border-slate-600"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setStartDate(event.target.value)}
              className="w-full bg-slate-800 text-white p-2 rounded border border-slate-600 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEndDate(event.target.value)}
              className="w-full bg-slate-800 text-white p-2 rounded border border-slate-600 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded font-medium"
        >
          {isLoading ? "Exporting..." : "Export Logs"}
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Download execution logs for compliance, auditing, or record-keeping purposes.
      </p>
    </div>
  );
}
