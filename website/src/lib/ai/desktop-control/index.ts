/**
 * Desktop Control Index
 * Main export point for all desktop automation utilities
 */

export * from "./types";
export * from "./vision";
export * from "./control";
export * from "./workflow";
export * from "./execution-runtime";
export * from "./workflow-templates";
export * from "./workflow-planner";
export * from "./firestore-persistence";

// Re-export key classes and functions for convenience
export { WorkflowExecutor, createSimpleWorkflow, createTradingMonitorWorkflow } from "./workflow";
export { ExecutionRuntime, ApprovalDialog, ExecutionMonitor } from "./execution-runtime";
export { executeAction, executeActionSequence, initializeDesktopControl } from "./control";
export { capturePerception, detectUIElements, getActiveWindow } from "./vision";
export { WorkflowPlanner, validateWorkflowPlan } from "./workflow-planner";
export { WORKFLOW_TEMPLATES, createWorkflowFromTemplate, getTemplatesByCategory } from "./workflow-templates";
export { FirestoreAdapter, AuditLogger, ExecutionHistory, ComplianceExportUI } from "./firestore-persistence";
export { useDesktopExecutor, WorkflowStatusPanel } from "./useDesktopExecutor";

