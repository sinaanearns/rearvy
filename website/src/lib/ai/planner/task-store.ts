import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import type { OrchestratorTask, OrchestratorTaskStatus, OrchestratorPlan, OrchestratorStep } from "./types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Planner:TaskStore");

/**
 * Persists and updates orchestration tasks in Firestore.
 * Enforces strict tenant separation using user_id.
 */
export const taskStore = {
  /** Creates a new task in Firestore. */
  async createTask(params: {
    userId: string;
    chatId: string;
    projectId?: string | null;
    goal: string;
  }): Promise<string> {
    const { userId, chatId, projectId = null, goal } = params;
    const now = new Date().toISOString();

    const taskRef = adminDb.collection(COLLECTIONS.ORCHESTRATION_TASKS).doc();
    const task: OrchestratorTask = {
      id: taskRef.id,
      user_id: userId,
      chat_id: chatId,
      project_id: projectId,
      goal,
      status: "planning",
      plan: null,
      step_states: {},
      error: null,
      created_at: now,
      updated_at: now,
      finished_at: null,
    };

    await taskRef.set(task);
    log.info(`Task created in Firestore: ${task.id} (user: ${userId})`);
    return task.id;
  },

  /** Retrieves a task and verifies ownership. */
  async getTask(taskId: string, userId: string): Promise<OrchestratorTask | null> {
    const doc = await adminDb.collection(COLLECTIONS.ORCHESTRATION_TASKS).doc(taskId).get();
    if (!doc.exists) {
      return null;
    }

    const task = doc.data() as OrchestratorTask;
    if (task.user_id !== userId) {
      log.warn(`Security Warning: User ${userId} tried to access task ${taskId} owned by user ${task.user_id}`);
      return null;
    }

    return task;
  },

  /** Updates the plan and switches status from 'planning' to 'running' or 'awaiting_approval'. */
  async setPlan(params: {
    taskId: string;
    userId: string;
    plan: OrchestratorPlan;
  }): Promise<void> {
    const { taskId, userId, plan } = params;
    const now = new Date().toISOString();

    const taskRef = adminDb.collection(COLLECTIONS.ORCHESTRATION_TASKS).doc(taskId);
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error(`Task ${taskId} not found or permission denied.`);
    }

    const stepStates: Record<string, OrchestratorStep> = {};
    for (const step of plan.steps) {
      stepStates[step.id] = step;
    }

    const status: OrchestratorTaskStatus = plan.requires_approval
      ? "awaiting_approval"
      : "running";

    await taskRef.update({
      plan,
      step_states: stepStates,
      status,
      updated_at: now,
    });

    log.info(`Plan stored for task ${taskId}. New status: ${status}`);
  },

  /** Transitions the top-level status of the task. */
  async updateStatus(params: {
    taskId: string;
    userId: string;
    status: OrchestratorTaskStatus;
    error?: string | null;
  }): Promise<void> {
    const { taskId, userId, status, error = null } = params;
    const now = new Date().toISOString();

    const taskRef = adminDb.collection(COLLECTIONS.ORCHESTRATION_TASKS).doc(taskId);
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error(`Task ${taskId} not found or permission denied.`);
    }

    const updates: Partial<OrchestratorTask> = {
      status,
      updated_at: now,
    };

    if (error !== null) {
      updates.error = error;
    }

    if (status === "completed" || status === "failed" || status === "cancelled") {
      updates.finished_at = now;
    }

    await taskRef.update(updates);
    log.info(`Task ${taskId} status updated to ${status}`);
  },

  /** Updates the execution state of a specific step. */
  async updateStep(params: {
    taskId: string;
    userId: string;
    stepId: string;
    updates: Partial<OrchestratorStep>;
  }): Promise<void> {
    const { taskId, userId, stepId, updates } = params;
    const now = new Date().toISOString();

    const taskRef = adminDb.collection(COLLECTIONS.ORCHESTRATION_TASKS).doc(taskId);
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error(`Task ${taskId} not found or permission denied.`);
    }

    const currentStep = task.step_states[stepId];
    if (!currentStep) {
      throw new Error(`Step ${stepId} not found in task ${taskId}`);
    }

    const updatedStep = {
      ...currentStep,
      ...updates,
    };

    const fieldPath = `step_states.${stepId}`;
    await taskRef.update({
      [fieldPath]: updatedStep,
      updated_at: now,
    });
  },

  /** Lists tasks for a user, enforcing tenant separation. */
  async listTasks(userId: string, limitCount = 20): Promise<OrchestratorTask[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.ORCHESTRATION_TASKS)
      .where("user_id", "==", userId)
      .orderBy("created_at", "desc")
      .limit(limitCount)
      .get();

    return snapshot.docs.map((doc) => doc.data() as OrchestratorTask);
  },
};
