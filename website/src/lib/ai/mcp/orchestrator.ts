import { generateObject, jsonSchema, type LanguageModel } from "ai";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type WorkflowExecution,
  type WorkflowExecutionStep,
} from "@/lib/firebase/schema";
import { resolveModelForChat } from "@/lib/ai/model-router";
import { createServerLogger } from "@/lib/server-logger";
import { writeAuditEvent } from "@/lib/audit/writer";
import {
  resolveMcpProvidersForCapabilities,
  selectMcpToolForTask,
  type BusinessCapability,
} from "./capability-graph";
import { invokeMcpTool } from "./hub";
import { selectAgentForPrompt } from "@/lib/ai/agents/multi-agent";
import {
  blockStepsWithFailedDependencies,
  getReadyWorkflowStepIndexes,
  getWorkflowStepDependencies,
  summarizeWorkflowState,
  validateWorkflowGraph,
} from "@/lib/rearvy-connectors/workflow-runtime";

const log = createServerLogger("ConnectorOrchestrator");

const CAPABILITY_VALUES = [
  "email",
  "crm",
  "calendar",
  "image_generation",
  "video_editing",
  "social_media",
  "finance",
  "inventory",
  "database",
  "documents",
  "storage",
  "analytics",
  "browser_automation",
  "search",
  "design",
  "development",
  "payments",
] as const;

const capabilitySchema = z.enum(CAPABILITY_VALUES);

const WorkflowPlanSchema = z
  .object({
    understoodGoal: z.string().min(1).max(1_000),
    assumptions: z.array(z.string().min(1).max(500)).max(20).default([]),
    confidence_score: z.number().min(0).max(1),
    requiredCapabilities: z.array(capabilitySchema).max(20),
    tasks: z
      .array(
        z.object({
          id: z
            .string()
            .regex(/^[a-z][a-z0-9_]*$/, "Task IDs must use lowercase snake_case."),
          name: z.string().min(1).max(160),
          capability: capabilitySchema,
          description: z.string().min(1).max(4_000),
          dependsOn: z.array(z.string()).max(20).default([]),
          requiresApproval: z.boolean().default(false),
        })
      )
      .min(1)
      .max(20),
  })
  .superRefine((plan, context) => {
    const taskIds = new Set<string>();
    plan.tasks.forEach((task, index) => {
      if (taskIds.has(task.id)) {
        context.addIssue({
          code: "custom",
          path: ["tasks", index, "id"],
          message: `Task ID '${task.id}' is duplicated.`,
        });
      }
      taskIds.add(task.id);
    });

    plan.tasks.forEach((task, taskIndex) => {
      task.dependsOn.forEach((dependencyId, dependencyIndex) => {
        if (!taskIds.has(dependencyId)) {
          context.addIssue({
            code: "custom",
            path: ["tasks", taskIndex, "dependsOn", dependencyIndex],
            message: `Dependency '${dependencyId}' does not identify a workflow task.`,
          });
        }
      });
    });
  });

const InvocationReadinessSchema = z.object({
  canExecute: z.boolean(),
  missingInputs: z.array(z.string().min(1).max(160)).max(20).default([]),
  reason: z.string().min(1).max(500),
});

class ConnectorInputRequiredError extends Error {
  constructor(readonly missingInputs: string[], message: string) {
    super(message);
    this.name = "ConnectorInputRequiredError";
  }
}

export interface WorkflowOrchestrationRequest {
  userId: string;
  orgId?: string | null;
  prompt: string;
  isDesktopApp?: boolean;
  allowedMcpServerIds?: string[] | null;
  userPermissions?: string[];
}

export interface WorkflowOrchestrationResult {
  executionId: string;
  prompt: string;
  agentRole: string;
  agentName: string;
  status: WorkflowExecution["status"];
  steps: WorkflowExecutionStep[];
  capabilitiesUsed: BusinessCapability[];
  mcpServersUsed: string[];
  needsApproval: boolean;
  summary: string;
  assumptions: string[];
  confidenceScore: number;
  error?: string;
}

export interface WorkflowResumeResult {
  executionId: string;
  status: WorkflowExecution["status"];
  steps: WorkflowExecutionStep[];
  needsApproval: boolean;
  summary: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringifyContext(value: unknown, maxLength = 20_000) {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length <= maxLength
    ? serialized
    : `${serialized.slice(0, maxLength)}\n[context truncated]`;
}

function readRequiredSchemaFields(schema: Record<string, unknown>) {
  return Array.isArray(schema.required)
    ? schema.required.filter((value): value is string => typeof value === "string")
    : [];
}

function isEmptyObjectSchema(schema: Record<string, unknown>) {
  const properties = isRecord(schema.properties) ? Object.keys(schema.properties) : [];
  return properties.length === 0 && readRequiredSchemaFields(schema).length === 0;
}

function severityForRisk(
  risk: WorkflowExecutionStep["risk"]
): "low" | "medium" | "high" | "critical" {
  if (risk === "destructive") return "critical";
  if (risk === "publish") return "high";
  if (risk === "write") return "medium";
  return "low";
}

export class MultiMcpOrchestrator {
  static async orchestrateGoal(
    request: WorkflowOrchestrationRequest
  ): Promise<WorkflowOrchestrationResult> {
    const {
      userId,
      orgId,
      prompt,
      isDesktopApp,
      userPermissions = [],
      allowedMcpServerIds = null,
    } = request;
    log.info(`Starting connector orchestration for goal: "${prompt.slice(0, 80)}"`);

    const agent = selectAgentForPrompt(prompt);
    const [workspaceContext, routedModel] = await Promise.all([
      MultiMcpOrchestrator.fetchWorkspaceContext(userId, orgId),
      resolveModelForChat({
        task: "deep_business_reasoning",
        routingMode: "quality",
        isDesktopApp: isDesktopApp ?? false,
      }),
    ]);

    if (!routedModel.model) {
      throw new Error("No AI model configured for workflow planning.");
    }

    const planResult = await generateObject({
      model: routedModel.model,
      schema: WorkflowPlanSchema,
      system: `${agent.systemInstructions}\n\nYou are Rearvy's universal workflow planner. Break an outcome into a small dependency graph of concrete tasks that connected apps, websites, AI tools, or desktop software can execute. State assumptions and confidence before execution. Mark sending, publishing, spending, account changes, file writes, and destructive actions for approval. Do not claim any connector is available; assignment happens after planning.`,
      prompt: `User goal: "${prompt}"\n\nAvailable workspace context:\n${stringifyContext(
        workspaceContext
      )}\n\nReturn a plan with at most 20 concrete tasks.`,
      temperature: 0.1,
    });

    const plan = planResult.object;
    const requiredCapabilities = Array.from(
      new Set(plan.tasks.map((task) => task.capability))
    ) as BusinessCapability[];
    const providerResolution = await resolveMcpProvidersForCapabilities(
      userId,
      requiredCapabilities,
      userPermissions,
      allowedMcpServerIds
    );

    const executionRef = adminDb.collection(COLLECTIONS.WORKFLOW_EXECUTIONS).doc();
    const executionId = executionRef.id;
    const mcpServersUsedSet = new Set<string>();

    const initialSteps: WorkflowExecutionStep[] = plan.tasks.map((task) => {
      const resolution = providerResolution[task.capability as BusinessCapability];
      const selectedMcp = resolution?.selectedProvider || null;
      const selectedOperation = selectedMcp
        ? selectMcpToolForTask(selectedMcp, task.capability as BusinessCapability, task.description)
        : null;

      if (selectedMcp && selectedOperation) mcpServersUsedSet.add(selectedMcp.id);

      const approvalRequired = Boolean(
        selectedOperation &&
          (task.requiresApproval ||
            selectedOperation.approval_required ||
            selectedOperation.risk !== "read")
      );
      const missingConnectorReason = selectedMcp
        ? `The '${selectedMcp.name}' connector must be tested again before Rearvy can assign a real operation for '${task.capability}'.`
        : `No active, allowed connector declares the '${task.capability}' capability.`;

      return {
        id: task.id,
        name: task.name,
        capability: task.capability,
        connector_id: selectedMcp?.id,
        connector_name: selectedMcp?.name,
        connector_transport: selectedMcp ? "mcp" : undefined,
        operation_id: selectedOperation?.name,
        operation_name: selectedOperation?.name,
        operation_input_schema: selectedOperation?.input_schema,
        risk: selectedOperation?.risk,
        approval_required: approvalRequired,
        depends_on: task.dependsOn,
        attempt_count: 0,
        idempotency_key: `${executionId}:${task.id}`,
        mcp_server_id: selectedMcp?.id,
        mcp_server_name: selectedMcp?.name,
        status:
          !selectedMcp || !selectedOperation
            ? "awaiting_connection"
            : approvalRequired
              ? "awaiting_approval"
              : "pending",
        input: {
          description: task.description,
          workspaceContext,
        },
        error: !selectedMcp || !selectedOperation ? missingConnectorReason : undefined,
      };
    });

    const graphErrors = validateWorkflowGraph(initialSteps);
    if (graphErrors.length > 0) {
      throw new Error(`The generated workflow graph is invalid: ${graphErrors.join(" ")}`);
    }

    const mcpServersUsed = Array.from(mcpServersUsedSet);
    const initialState = summarizeWorkflowState(initialSteps);
    const now = new Date().toISOString();
    await executionRef.set({
      user_id: userId,
      org_id: orgId || null,
      prompt,
      agent_role: agent.role,
      agent_name: agent.name,
      assumptions: plan.assumptions,
      confidence_score: plan.confidence_score,
      status: initialState.status,
      steps: initialSteps,
      capabilities_used: requiredCapabilities,
      mcp_servers_used: mcpServersUsed,
      connector_ids_used: mcpServersUsed,
      needs_approval: initialState.needsApproval,
      summary: initialState.summary,
      created_at: now,
      updated_at: now,
    });

    const execution = await MultiMcpOrchestrator.runExecutionLoop(
      executionId,
      userId,
      routedModel.model,
      initialSteps,
      isDesktopApp ?? false
    );

    return {
      executionId,
      prompt,
      agentRole: agent.role,
      agentName: agent.name,
      status: execution.status,
      steps: execution.steps,
      capabilitiesUsed: requiredCapabilities,
      mcpServersUsed,
      needsApproval: execution.needsApproval,
      summary: execution.summary,
      assumptions: plan.assumptions,
      confidenceScore: plan.confidence_score,
    };
  }

  static async approveStep(options: {
    executionId: string;
    stepId: string;
    userId: string;
    isDesktopApp?: boolean;
  }): Promise<WorkflowResumeResult> {
    const executionRef = adminDb
      .collection(COLLECTIONS.WORKFLOW_EXECUTIONS)
      .doc(options.executionId);

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(executionRef);
      if (!snapshot.exists) throw new Error("Workflow execution not found.");
      const data = snapshot.data() || {};
      if (data.user_id !== options.userId) {
        throw new Error("Workflow execution is not owned by this user.");
      }

      const steps = Array.isArray(data.steps)
        ? (data.steps as WorkflowExecutionStep[]).map((step) => ({ ...step }))
        : [];
      const step = steps.find((candidate) => candidate.id === options.stepId);
      if (!step) throw new Error("Workflow step not found.");
      if (step.status !== "awaiting_approval") {
        throw new Error("Only a step awaiting approval can be approved.");
      }

      step.status = "pending";
      step.error = undefined;
      step.approved_at = new Date().toISOString();
      step.approved_by = options.userId;
      const state = summarizeWorkflowState(steps);
      transaction.update(executionRef, {
        steps,
        status: state.status,
        needs_approval: state.needsApproval,
        summary: state.summary,
        updated_at: new Date().toISOString(),
      });
    });

    await writeAuditEvent({
      userId: options.userId,
      category: "connector_workflow",
      action: "workflow_step_approved",
      resourceId: options.executionId,
      metadata: { stepId: options.stepId },
      severity: "high",
    });

    return MultiMcpOrchestrator.resumeExecution(
      options.executionId,
      options.userId,
      options.isDesktopApp ?? false
    );
  }

  static async resumeExecution(
    executionId: string,
    userId: string,
    isDesktopApp = false
  ): Promise<WorkflowResumeResult> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.WORKFLOW_EXECUTIONS)
      .doc(executionId)
      .get();
    if (!snapshot.exists) throw new Error("Workflow execution not found.");

    const data = snapshot.data() || {};
    if (data.user_id !== userId) {
      throw new Error("Workflow execution is not owned by this user.");
    }
    if (data.status === "canceled") throw new Error("A canceled workflow cannot be resumed.");

    const routedModel = await resolveModelForChat({
      task: "deep_business_reasoning",
      routingMode: "quality",
      isDesktopApp,
    });
    if (!routedModel.model) throw new Error("No AI model configured for workflow execution.");

    const steps = Array.isArray(data.steps) ? (data.steps as WorkflowExecutionStep[]) : [];
    return MultiMcpOrchestrator.runExecutionLoop(
      executionId,
      userId,
      routedModel.model,
      steps,
      isDesktopApp
    );
  }

  private static async runExecutionLoop(
    executionId: string,
    userId: string,
    model: LanguageModel,
    steps: WorkflowExecutionStep[],
    isDesktopApp: boolean
  ): Promise<WorkflowResumeResult> {
    let updatedSteps = steps.map((step) => ({ ...step }));

    try {
      while (true) {
        updatedSteps = blockStepsWithFailedDependencies(updatedSteps);
        const readyIndexes = getReadyWorkflowStepIndexes(updatedSteps);
        if (readyIndexes.length === 0) break;

        const startedAt = new Date().toISOString();
        readyIndexes.forEach((index) => {
          updatedSteps[index] = {
            ...updatedSteps[index],
            status: "running",
            attempt_count: (updatedSteps[index]?.attempt_count ?? 0) + 1,
            started_at: startedAt,
            finished_at: undefined,
            error: undefined,
          };
        });
        await MultiMcpOrchestrator.updateExecutionStatus(
          executionId,
          updatedSteps,
          summarizeWorkflowState(updatedSteps)
        );

        const batchResults = await Promise.all(
          readyIndexes.map((index) =>
            MultiMcpOrchestrator.executeStep(
              executionId,
              userId,
              model,
              updatedSteps[index],
              updatedSteps,
              isDesktopApp
            )
          )
        );
        batchResults.forEach((step, resultIndex) => {
          updatedSteps[readyIndexes[resultIndex]] = step;
        });

        await MultiMcpOrchestrator.updateExecutionStatus(
          executionId,
          updatedSteps,
          summarizeWorkflowState(updatedSteps)
        );
      }

      updatedSteps = blockStepsWithFailedDependencies(updatedSteps);
      const state = summarizeWorkflowState(updatedSteps);
      await MultiMcpOrchestrator.updateExecutionStatus(executionId, updatedSteps, state);
      return { executionId, steps: updatedSteps, ...state };
    } catch (loopError) {
      log.error(`Execution loop failed for ${executionId}:`, loopError);
      const state = summarizeWorkflowState(updatedSteps);
      await MultiMcpOrchestrator.updateExecutionStatus(
        executionId,
        updatedSteps,
        {
          ...state,
          status: "failed",
          summary: "Workflow execution stopped because its coordinator failed.",
        },
        loopError instanceof Error ? loopError.message : String(loopError)
      );
      throw loopError;
    }
  }

  private static async executeStep(
    executionId: string,
    userId: string,
    model: LanguageModel,
    step: WorkflowExecutionStep,
    allSteps: WorkflowExecutionStep[],
    isDesktopApp: boolean
  ): Promise<WorkflowExecutionStep> {
    const finishedAt = () => new Date().toISOString();

    try {
      if (!step.connector_id || !step.operation_id) {
        return {
          ...step,
          status: "awaiting_connection",
          error: `No executable connector operation is assigned for '${step.capability}'.`,
          finished_at: finishedAt(),
        };
      }

      const dependencyOutputs = Object.fromEntries(
        getWorkflowStepDependencies(step).map((dependencyId) => {
          const dependency = allSteps.find((candidate) => candidate.id === dependencyId);
          return [dependencyId, dependency?.output ?? null];
        })
      );
      const connectorArguments = await MultiMcpOrchestrator.buildConnectorArguments(
        model,
        step,
        dependencyOutputs
      );
      const invocation = await invokeMcpTool({
        userId,
        serverId: step.connector_id,
        toolName: step.operation_id,
        arguments: connectorArguments,
        isDesktopApp,
        maxAttempts: step.risk === "read" ? 3 : 1,
      });

      await writeAuditEvent({
        userId,
        category: "connector_workflow",
        action: "connector_operation_executed",
        resourceId: executionId,
        metadata: {
          stepId: step.id,
          connectorId: step.connector_id,
          operationId: step.operation_id,
          risk: step.risk ?? "read",
          idempotencyKey: step.idempotency_key ?? null,
          durationMs: invocation.durationMs,
        },
        severity: severityForRisk(step.risk),
      });

      return {
        ...step,
        status: "succeeded",
        output: {
          connector_id: invocation.serverId,
          connector_name: invocation.serverName,
          operation_id: invocation.toolName,
          result: invocation.output,
          duration_ms: invocation.durationMs,
        },
        error: undefined,
        finished_at: finishedAt(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let status: WorkflowExecutionStep["status"] = "failed";
      if (error instanceof ConnectorInputRequiredError || /missing|required input|validation/i.test(message)) {
        status = "awaiting_input";
      } else if (
        /connector.*(disabled|reconnect|does not belong|no longer exists)|requires Rearvy Desktop/i.test(
          message
        )
      ) {
        status = "awaiting_connection";
      }

      await writeAuditEvent({
        userId,
        category: "connector_workflow",
        action: "connector_operation_failed",
        resourceId: executionId,
        metadata: {
          stepId: step.id,
          connectorId: step.connector_id ?? null,
          operationId: step.operation_id ?? null,
          risk: step.risk ?? null,
          error: message.slice(0, 1_000),
        },
        severity: severityForRisk(step.risk),
      });

      return {
        ...step,
        status,
        error: message,
        finished_at: finishedAt(),
      };
    }
  }

  private static async buildConnectorArguments(
    model: LanguageModel,
    step: WorkflowExecutionStep,
    dependencyOutputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const inputSchema = step.operation_input_schema ?? {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    if (isEmptyObjectSchema(inputSchema)) return {};

    const groundedContext = {
      task: step.input.description ?? step.name,
      workspaceContext: step.input.workspaceContext ?? {},
      dependencyOutputs,
    };
    const requiredFields = readRequiredSchemaFields(inputSchema);
    const readiness = await generateObject({
      model,
      schema: InvocationReadinessSchema,
      system:
        "Decide whether the supplied context contains enough grounded information to call one connector operation. Never invent credentials, account IDs, URLs, file paths, recipient addresses, payment details, or private identifiers. If any required value is missing, set canExecute to false and name the missing inputs.",
      prompt: `Operation: ${step.operation_id}\nRequired fields: ${requiredFields.join(", ") || "none"}\nInput schema:\n${stringifyContext(
        inputSchema
      )}\nGrounded context:\n${stringifyContext(groundedContext)}`,
      temperature: 0,
    });

    if (!readiness.object.canExecute) {
      throw new ConnectorInputRequiredError(
        readiness.object.missingInputs,
        readiness.object.missingInputs.length > 0
          ? `Connector input required: ${readiness.object.missingInputs.join(", ")}.`
          : readiness.object.reason
      );
    }

    const generatedArguments = await generateObject({
      model,
      schema: jsonSchema(inputSchema as Parameters<typeof jsonSchema>[0]),
      schemaName: "connector_operation_arguments",
      schemaDescription: `Arguments for connector operation '${step.operation_id}'.`,
      system:
        "Create arguments for exactly one connector operation. Use only values present in the grounded context. Preserve identifiers and URLs exactly. Do not invent secrets, accounts, people, files, or approval.",
      prompt: stringifyContext(groundedContext),
      temperature: 0,
    });

    if (!isRecord(generatedArguments.object)) {
      throw new Error("The connector argument planner did not return an object.");
    }
    return generatedArguments.object;
  }

  private static async updateExecutionStatus(
    executionId: string,
    steps: WorkflowExecutionStep[],
    state: ReturnType<typeof summarizeWorkflowState>,
    error?: string
  ) {
    const updates: Record<string, unknown> = {
      status: state.status,
      steps,
      needs_approval: state.needsApproval,
      summary: state.summary,
      updated_at: new Date().toISOString(),
    };
    if (error) updates.error = error;

    await adminDb.collection(COLLECTIONS.WORKFLOW_EXECUTIONS).doc(executionId).update(updates);
  }

  private static async fetchWorkspaceContext(userId: string, orgId?: string | null) {
    try {
      if (orgId) {
        const [orgDoc, memberships] = await Promise.all([
          adminDb.collection(COLLECTIONS.ORGANIZATIONS).doc(orgId).get(),
          adminDb
            .collection(COLLECTIONS.ORGANIZATION_MEMBERS)
            .where("user_id", "==", userId)
            .limit(100)
            .get(),
        ]);
        if (orgDoc.exists) {
          const data = orgDoc.data();
          const isMember = memberships.docs.some((doc) => doc.data().org_id === orgId);
          if (data?.owner_user_id !== userId && !isMember) {
            throw new Error("The requested organization is not available to this user.");
          }
          if (data?.brand_memory) return data.brand_memory;
        }
      }

      const profileDoc = await adminDb.collection(COLLECTIONS.PROFILES).doc(userId).get();
      if (profileDoc.exists) {
        const profile = profileDoc.data();
        return {
          workspace_name: profile?.business_name || profile?.full_name || "My workspace",
          brand_colors: ["#6366F1", "#06B6D4"],
          writing_style: "Clear and concise",
          tone: "Confident and friendly",
        };
      }
    } catch (error) {
      if (error instanceof Error && /organization is not available/i.test(error.message)) {
        throw error;
      }
      log.warn("Failed to fetch workspace context:", error);
    }

    return {
      workspace_name: "My workspace",
      writing_style: "Clear and concise",
      tone: "Helpful",
    };
  }
}
