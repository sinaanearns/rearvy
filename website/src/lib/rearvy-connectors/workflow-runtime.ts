import type {
  WorkflowExecution,
  WorkflowExecutionStep,
} from "@/lib/firebase/schema";

const WAITING_STEP_STATUSES = new Set<WorkflowExecutionStep["status"]>([
  "awaiting_approval",
  "awaiting_connection",
  "awaiting_input",
]);

const FAILED_DEPENDENCY_STATUSES = new Set<WorkflowExecutionStep["status"]>([
  "failed",
  "blocked",
  "skipped",
]);

export function getWorkflowStepDependencies(step: WorkflowExecutionStep): string[] {
  if (Array.isArray(step.depends_on)) {
    return step.depends_on.filter((value): value is string => typeof value === "string");
  }

  const legacyDependencies = step.input.dependsOn;
  return Array.isArray(legacyDependencies)
    ? legacyDependencies.filter((value): value is string => typeof value === "string")
    : [];
}

export function validateWorkflowGraph(steps: WorkflowExecutionStep[]): string[] {
  const errors: string[] = [];
  const stepIds = new Set<string>();

  for (const step of steps) {
    if (stepIds.has(step.id)) errors.push(`Workflow step ID '${step.id}' is duplicated.`);
    stepIds.add(step.id);
  }

  for (const step of steps) {
    for (const dependencyId of getWorkflowStepDependencies(step)) {
      if (dependencyId === step.id) {
        errors.push(`Workflow step '${step.id}' cannot depend on itself.`);
      } else if (!stepIds.has(dependencyId)) {
        errors.push(`Workflow step '${step.id}' depends on missing step '${dependencyId}'.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stepById = new Map(steps.map((step) => [step.id, step]));

  const visit = (stepId: string): boolean => {
    if (visiting.has(stepId)) return true;
    if (visited.has(stepId)) return false;

    visiting.add(stepId);
    const step = stepById.get(stepId);
    for (const dependencyId of step ? getWorkflowStepDependencies(step) : []) {
      if (stepById.has(dependencyId) && visit(dependencyId)) return true;
    }
    visiting.delete(stepId);
    visited.add(stepId);
    return false;
  };

  for (const step of steps) {
    if (visit(step.id)) {
      errors.push("Workflow dependencies contain a cycle.");
      break;
    }
  }

  return errors;
}

export function getReadyWorkflowStepIndexes(steps: WorkflowExecutionStep[]): number[] {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const ready: number[] = [];

  steps.forEach((step, index) => {
    if (step.status !== "pending") return;
    const dependencies = getWorkflowStepDependencies(step);
    if (dependencies.every((dependencyId) => stepById.get(dependencyId)?.status === "succeeded")) {
      ready.push(index);
    }
  });

  return ready;
}

export function blockStepsWithFailedDependencies(
  steps: WorkflowExecutionStep[]
): WorkflowExecutionStep[] {
  const nextSteps = steps.map((step) => ({ ...step }));
  let changed = true;

  while (changed) {
    changed = false;
    const stepById = new Map(nextSteps.map((step) => [step.id, step]));

    for (const step of nextSteps) {
      if (step.status !== "pending") continue;
      const failedDependencyId = getWorkflowStepDependencies(step).find((dependencyId) => {
        const dependencyStatus = stepById.get(dependencyId)?.status;
        return dependencyStatus ? FAILED_DEPENDENCY_STATUSES.has(dependencyStatus) : false;
      });
      if (!failedDependencyId) continue;

      step.status = "blocked";
      step.error = `Blocked because dependency '${failedDependencyId}' did not succeed.`;
      step.finished_at = new Date().toISOString();
      changed = true;
    }
  }

  return nextSteps;
}

export interface WorkflowStateSummary {
  status: WorkflowExecution["status"];
  needsApproval: boolean;
  summary: string;
}

export function summarizeWorkflowState(steps: WorkflowExecutionStep[]): WorkflowStateSummary {
  const succeeded = steps.filter((step) => step.status === "succeeded").length;
  const failed = steps.filter((step) => step.status === "failed").length;
  const blocked = steps.filter((step) => step.status === "blocked").length;
  const waiting = steps.filter((step) => WAITING_STEP_STATUSES.has(step.status)).length;
  const running = steps.filter((step) => step.status === "running").length;
  const pending = steps.filter((step) => step.status === "pending").length;
  const ready = getReadyWorkflowStepIndexes(steps).length;
  const needsApproval = steps.some((step) => step.status === "awaiting_approval");

  if (running > 0 || ready > 0) {
    return {
      status: "executing",
      needsApproval,
      summary: `Executing workflow: ${succeeded} of ${steps.length} steps completed.`,
    };
  }

  if (waiting > 0) {
    return {
      status: "waiting",
      needsApproval,
      summary: `Workflow is waiting on ${waiting} step${waiting === 1 ? "" : "s"}; ${succeeded} completed.`,
    };
  }

  if (pending > 0) {
    return {
      status: "waiting",
      needsApproval,
      summary: `Workflow is waiting for dependencies; ${succeeded} of ${steps.length} steps completed.`,
    };
  }

  if (failed > 0 || blocked > 0) {
    const status = succeeded > 0 ? "partially_completed" : "failed";
    return {
      status,
      needsApproval: false,
      summary:
        status === "partially_completed"
          ? `Workflow partially completed: ${succeeded} succeeded, ${failed} failed, and ${blocked} blocked.`
          : `Workflow failed: ${failed} step${failed === 1 ? "" : "s"} failed and ${blocked} were blocked.`,
    };
  }

  return {
    status: "completed",
    needsApproval: false,
    summary: `Successfully executed all ${succeeded} workflow steps.`,
  };
}
