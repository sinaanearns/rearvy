"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import {
  WorkflowExecutionMonitor,
  type WorkflowExecutionMonitorProps,
  type WorkflowStep,
} from "./workflow-execution-monitor";

type WorkflowStatus = WorkflowExecutionMonitorProps["status"];

interface ConnectorWorkflowView {
  executionId: string;
  prompt: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  capabilitiesUsed: string[];
  connectorIdsUsed: string[];
  needsApproval: boolean;
  summary: string;
  assumptions: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readWorkflowStatus(value: unknown): WorkflowStatus {
  const statuses: WorkflowStatus[] = [
    "planning",
    "executing",
    "waiting",
    "completed",
    "partially_completed",
    "failed",
    "retrying",
    "canceled",
  ];
  return statuses.includes(value as WorkflowStatus) ? (value as WorkflowStatus) : "waiting";
}

function readStepStatus(value: unknown): WorkflowStep["status"] {
  const statuses: WorkflowStep["status"][] = [
    "pending",
    "running",
    "succeeded",
    "failed",
    "skipped",
    "blocked",
    "awaiting_approval",
    "awaiting_connection",
    "awaiting_input",
  ];
  return statuses.includes(value as WorkflowStep["status"])
    ? (value as WorkflowStep["status"])
    : "pending";
}

function normalizeStep(value: unknown, index: number): WorkflowStep | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id, `step_${index + 1}`);
  const rawOutput = isRecord(value.output)
    ? value.output
    : isRecord(value.result)
      ? value.result
      : undefined;

  return {
    id,
    name: readString(value.name, id),
    capability: readString(value.capability, "connected_app"),
    connector_name: readString(value.connector_name || value.connectorName) || undefined,
    operation_name: readString(value.operation_name || value.operationName) || undefined,
    mcp_server_name: readString(value.mcp_server_name) || undefined,
    status: readStepStatus(value.status),
    input: isRecord(value.input) ? value.input : undefined,
    output: rawOutput,
    error: readString(value.error) || undefined,
  };
}

function parseWorkflowOutput(output: unknown): ConnectorWorkflowView | null {
  const root = isRecord(output) ? output : null;
  const execution = root && isRecord(root.execution) ? root.execution : root;
  if (!execution) return null;

  const executionId = readString(execution.executionId || execution.execution_id);
  if (!executionId || !Array.isArray(execution.steps)) return null;

  return {
    executionId,
    prompt: readString(execution.goal || execution.prompt, "Connected app workflow"),
    status: readWorkflowStatus(execution.status),
    steps: execution.steps.flatMap((step, index) => {
      const normalized = normalizeStep(step, index);
      return normalized ? [normalized] : [];
    }),
    capabilitiesUsed: readStringArray(execution.capabilitiesUsed || execution.capabilities_used),
    connectorIdsUsed: readStringArray(execution.connectorIdsUsed || execution.connector_ids_used),
    needsApproval: execution.needsApproval === true || execution.needs_approval === true,
    summary: readString(execution.summary, "Workflow planned."),
    assumptions: readStringArray(execution.assumptions),
  };
}

export function ConnectorWorkflowCard({ output }: { output: unknown }) {
  const { user } = useAuth();
  const parsedWorkflow = useMemo(() => parseWorkflowOutput(output), [output]);
  const [updatedWorkflow, setUpdatedWorkflow] = useState<ConnectorWorkflowView | null>(null);
  const [approvingStepId, setApprovingStepId] = useState<string | null>(null);
  const workflow = updatedWorkflow ?? parsedWorkflow;

  if (!workflow) return null;

  const approveStep = async (stepId: string) => {
    if (!user) {
      toast.error("Sign in again before approving this action.");
      return;
    }

    setApprovingStepId(stepId);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/mcp/orchestrate/${encodeURIComponent(workflow.executionId)}/steps/${encodeURIComponent(
          stepId
        )}/approve`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Unable to approve this workflow step."
        );
      }
      const result = isRecord(payload) ? payload : {};
      const nextSteps = Array.isArray(result.steps)
        ? result.steps.flatMap((step, index) => {
            const normalized = normalizeStep(step, index);
            return normalized ? [normalized] : [];
          })
        : workflow.steps;

      setUpdatedWorkflow({
        ...workflow,
        status: readWorkflowStatus(result.status),
        steps: nextSteps,
        needsApproval: result.needsApproval === true,
        summary: readString(result.summary, workflow.summary),
      });
      toast.success("Step approved and workflow resumed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve this workflow step.");
    } finally {
      setApprovingStepId(null);
    }
  };

  return (
    <WorkflowExecutionMonitor
      executionId={workflow.executionId}
      prompt={workflow.prompt}
      status={workflow.status}
      steps={workflow.steps}
      capabilitiesUsed={workflow.capabilitiesUsed}
      mcpServersUsed={workflow.connectorIdsUsed}
      needsApproval={workflow.needsApproval}
      summary={workflow.summary}
      assumptions={workflow.assumptions}
      approvingStepId={approvingStepId}
      onApproveStep={approveStep}
    />
  );
}
