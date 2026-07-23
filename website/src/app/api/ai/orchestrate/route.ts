import { requireAuth } from "@/lib/firebase/middleware";
import { generateExecutionPlan } from "@/lib/ai/planner/plan-generator";
import { executeStep } from "@/lib/ai/planner/step-executor";
import { taskStore } from "@/lib/ai/planner/task-store";
import type { OrchestratorStep, OrchestratorPlan } from "@/lib/ai/planner/types";
import { createServerLogger } from "@/lib/server-logger";
import { adminDb } from "@/lib/firebase/admin";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 800;

const log = createServerLogger("Api:Orchestrate");

const encoder = new TextEncoder();

/** Sends a Server-Sent Event chunk down the stream. */
function sendSSE(
  controller: ReadableStreamDefaultController,
  eventName: string,
  data: Record<string, unknown>
) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(payload));
}

/**
 * POST /api/ai/orchestrate
 *
 * Stream-based execution engine for Rearvy 3.0 multi-step orchestration.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const user = auth.user!;
  const userId = user.uid;

  interface OrchestrateRequest {
    action?: string;
    goal?: string;
    chatId?: string;
    projectId?: string | null;
    taskId?: string;
  }

  let payload: OrchestrateRequest;
  try {
    payload = (await req.json()) as OrchestrateRequest;
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { action = "start", goal, chatId, projectId = null, taskId } = payload;

  if (action === "start" && (!goal || !chatId)) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: goal, chatId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (action === "approve" && !taskId) {
    return new Response(JSON.stringify({ error: "Missing required field: taskId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const desktopHeader = req.headers.get("x-rearvy-desktop") || "";
  const isDesktopApp =
    desktopHeader === "1" ||
    desktopHeader.toLowerCase() === "true" ||
    req.headers.get("user-agent")?.toLowerCase().includes("electron") ||
    false;

  const stream = new ReadableStream({
    async start(controller) {
      let activeTaskId = taskId || "";

      try {
        if (action === "start") {
          // 1. Initialize Task in Firestore
          activeTaskId = await taskStore.createTask({
            userId,
            chatId: chatId as string,
            projectId,
            goal: goal as string,
          });

          // 2. Generate Plan
          let plan: OrchestratorPlan;
          try {
            plan = await generateExecutionPlan({
              userId,
              chatId: chatId as string,
              projectId,
              goal: goal as string,
              isDesktopApp,
            });
          } catch (planError: any) {
            log.error(`Plan generation failed for task ${activeTaskId}:`, planError);
            await taskStore.updateStatus({
              taskId: activeTaskId,
              userId,
              status: "failed",
              error: planError.message || String(planError),
            });
            sendSSE(controller, "orchestration_error", {
              task_id: activeTaskId,
              error: planError.message || String(planError),
            });
            controller.close();
            return;
          }

          // 3. Save generated plan
          await taskStore.setPlan({
            taskId: activeTaskId,
            userId,
            plan,
          });

          sendSSE(controller, "plan_generated", { plan, task_id: activeTaskId });

          // 4. Handle Confidence Gating / Approval Gate
          if (plan.requires_approval) {
            await taskStore.updateStatus({
              taskId: activeTaskId,
              userId,
              status: "awaiting_approval",
            });
            sendSSE(controller, "approval_required", {
              task_id: activeTaskId,
              reason: plan.confidence_score < 0.7 ? "confidence_below_threshold" : "sensitive_actions",
              plan,
            });
            controller.close();
            return;
          }

          // Transition to running status if no approval is required
          await taskStore.updateStatus({
            taskId: activeTaskId,
            userId,
            status: "running",
          });
        } else if (action === "approve") {
          // Verify task exists and is owned by caller
          const task = await taskStore.getTask(activeTaskId, userId);
          if (!task) {
            sendSSE(controller, "orchestration_error", {
              task_id: activeTaskId,
              error: "Task not found or access denied",
            });
            controller.close();
            return;
          }

          if (task.status !== "awaiting_approval") {
            sendSSE(controller, "orchestration_error", {
              task_id: activeTaskId,
              error: `Task is not awaiting approval (current status: ${task.status})`,
            });
            controller.close();
            return;
          }

          // Approve execution and transition status to running
          await taskStore.updateStatus({
            taskId: activeTaskId,
            userId,
            status: "running",
          });
        }

        // 5. Execution Loop (ordered step dispatching based on dependencies)
        const task = await taskStore.getTask(activeTaskId, userId);
        if (!task || !task.plan) {
          throw new Error("Task execution plan is missing.");
        }

        const steps = [...task.plan.steps];
        const stepStates = { ...task.step_states };
        let hasFailedStep = false;
        let stepsCompletedCount = 0;

        // Iterate and execute dependency-resolved steps
        while (steps.some((s) => s.status === "pending" || s.status === "running")) {
          const runnableSteps = steps.filter((step) => {
            if (step.status !== "pending") return false;
            // Check if all dependencies are "done"
            return step.dependencies.every(
              (depId) => stepStates[depId]?.status === "done"
            );
          });

          if (runnableSteps.length === 0) {
            // Check for circular dependencies or stuck execution
            const pendingSteps = steps.filter((s) => s.status === "pending");
            if (pendingSteps.length > 0) {
              log.error(`Stuck execution. Steps are pending but dependencies cannot resolve.`, pendingSteps);
              for (const step of pendingSteps) {
                await taskStore.updateStep({
                  taskId: activeTaskId,
                  userId,
                  stepId: step.id,
                  updates: { status: "failed", error: "Dependency resolution failure (deadlock)" },
                });
              }
              hasFailedStep = true;
            }
            break;
          }

          // Execute runnable steps (for simplicity and ordering safety, execute sequentially or in parallel)
          for (const step of runnableSteps) {
            // Update step status in Firestore & SSE
            step.status = "running";
            step.startedAt = new Date().toISOString();
            stepStates[step.id] = step;

            await taskStore.updateStep({
              taskId: activeTaskId,
              userId,
              stepId: step.id,
              updates: { status: "running", startedAt: step.startedAt },
            });

            sendSSE(controller, "step_started", {
              step_id: step.id,
              step_name: step.name,
              task_id: activeTaskId,
            });

            // Perform execution
            const executionResult = await executeStep(step, {
              userId,
              adminDb,
              chatId: task.chat_id,
              projectId: task.project_id,
              isDesktopApp,
            });

            step.finishedAt = new Date().toISOString();

            if (executionResult.ok) {
              step.status = "done";
              step.result = executionResult.result;
              stepStates[step.id] = step;
              stepsCompletedCount++;

              await taskStore.updateStep({
                taskId: activeTaskId,
                userId,
                stepId: step.id,
                updates: {
                  status: "done",
                  finishedAt: step.finishedAt,
                  result: step.result,
                },
              });

              sendSSE(controller, "step_done", {
                step_id: step.id,
                step_name: step.name,
                result: step.result,
                task_id: activeTaskId,
              });
            } else {
              step.status = "failed";
              step.error = executionResult.error;
              stepStates[step.id] = step;
              hasFailedStep = true;

              await taskStore.updateStep({
                taskId: activeTaskId,
                userId,
                stepId: step.id,
                updates: {
                  status: "failed",
                  finishedAt: step.finishedAt,
                  error: step.error,
                },
              });

              sendSSE(controller, "step_failed", {
                step_id: step.id,
                step_name: step.name,
                error: step.error || "Unknown execution error",
                task_id: activeTaskId,
              });

              // Mark dependent steps as skipped
              const dependentSteps = steps.filter((s) =>
                s.dependencies.includes(step.id)
              );
              for (const depStep of dependentSteps) {
                depStep.status = "skipped";
                stepStates[depStep.id] = depStep;
                await taskStore.updateStep({
                  taskId: activeTaskId,
                  userId,
                  stepId: depStep.id,
                  updates: { status: "skipped" },
                });
              }

              break; // Stop planning chain execution on step failure
            }
          }

          if (hasFailedStep) {
            break;
          }
        }

        // Finalize task status in Firestore & stream close
        const finalStatus = hasFailedStep ? "failed" : "completed";
        await taskStore.updateStatus({
          taskId: activeTaskId,
          userId,
          status: finalStatus,
        });

        sendSSE(controller, "orchestration_complete", {
          task_id: activeTaskId,
          summary: hasFailedStep ? "Workflow finished with errors." : "Workflow completed successfully.",
          steps_completed: stepsCompletedCount,
          steps_failed: hasFailedStep ? 1 : 0,
        });
      } catch (err: any) {
        log.error(`Execution error on task ${activeTaskId}:`, err);
        if (activeTaskId) {
          await taskStore.updateStatus({
            taskId: activeTaskId,
            userId,
            status: "failed",
            error: err.message || String(err),
          });
        }
        sendSSE(controller, "orchestration_error", {
          task_id: activeTaskId,
          error: err.message || String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
