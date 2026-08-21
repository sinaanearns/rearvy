"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Play,
  RotateCw,
  Server,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export type WorkflowStep = {
  id: string;
  name: string;
  capability: string;
  connector_name?: string;
  operation_name?: string;
  mcp_server_name?: string;
  status:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "blocked"
    | "awaiting_approval"
    | "awaiting_connection"
    | "awaiting_input";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
};

export type WorkflowExecutionMonitorProps = {
  executionId: string;
  prompt: string;
  status:
    | "planning"
    | "executing"
    | "waiting"
    | "completed"
    | "partially_completed"
    | "failed"
    | "retrying"
    | "canceled";
  steps: WorkflowStep[];
  capabilitiesUsed: string[];
  mcpServersUsed: string[];
  needsApproval: boolean;
  summary?: string;
  assumptions?: string[];
  approvingStepId?: string | null;
  onApproveStep?: (stepId: string) => void | Promise<void>;
};

export function WorkflowExecutionMonitor({
  prompt,
  status,
  steps,
  capabilitiesUsed,
  summary,
  assumptions = [],
  approvingStepId = null,
  onApproveStep,
}: WorkflowExecutionMonitorProps) {
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "completed":
      case "succeeded":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
          </Badge>
        );
      case "executing":
      case "running":
        return (
          <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border-sky-500/30 animate-pulse">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Executing
          </Badge>
        );
      case "waiting":
      case "awaiting_approval":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30">
            <ShieldCheck className="mr-1 h-3 w-3" /> Awaiting Approval
          </Badge>
        );
      case "awaiting_connection":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30">
            <Server className="mr-1 h-3 w-3" /> Connection Needed
          </Badge>
        );
      case "awaiting_input":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30">
            <Clock className="mr-1 h-3 w-3" /> Input Needed
          </Badge>
        );
      case "partially_completed":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30">
            <AlertTriangle className="mr-1 h-3 w-3" /> Partially Completed
          </Badge>
        );
      case "failed":
      case "blocked":
        return (
          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border-rose-500/30">
            <AlertTriangle className="mr-1 h-3 w-3" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" /> Pending
          </Badge>
        );
    }
  };

  return (
    <Card className="overflow-hidden border-indigo-500/20 shadow-md">
      <CardHeader className="bg-muted/40 p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base font-semibold">Connected App Workflow</CardTitle>
          </div>
          {getStatusBadge(status)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">Prompt: &quot;{prompt}&quot;</p>
        {summary ? <p className="mt-1 text-xs text-muted-foreground">{summary}</p> : null}
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Capability Tags */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground font-medium mr-1">Capabilities:</span>
          {capabilitiesUsed.map((cap) => (
            <Badge key={cap} variant="secondary" className="text-[10px] font-normal py-0 px-2">
              {cap}
            </Badge>
          ))}
        </div>

        {assumptions.length > 0 ? (
          <div className="rounded-[8px] border border-border/60 bg-muted/20 p-3 text-xs">
            <p className="font-medium text-foreground">Plan assumptions</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Workflow Steps DAG Timeline */}
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              onClick={() => setSelectedStep(step)}
              className={`group flex items-center justify-between p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                selectedStep?.id === step.id
                  ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
                  : "border-border/60 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{step.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3 text-indigo-400" />
                      {step.connector_name || step.mcp_server_name || "Connection needed"}
                    </span>
                    <span>•</span>
                    <span className="capitalize">
                      {step.operation_name || step.capability.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {step.status === "awaiting_approval" && onApproveStep ? (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={approvingStepId === step.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onApproveStep(step.id);
                    }}
                  >
                    {approvingStepId === step.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-3 w-3" />
                    )}
                    Approve
                  </Button>
                ) : null}
                {getStatusBadge(step.status)}
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Selected Step Inspector Drawer */}
        {selectedStep ? (
          <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold">
              <span>Step Inspection: {selectedStep.name}</span>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setSelectedStep(null)}>
                Close
              </Button>
            </div>
            {selectedStep.error ? (
              <div className="text-rose-600 dark:text-rose-400 font-medium">
                Error: {selectedStep.error}
              </div>
            ) : null}
            {selectedStep.output ? (
              <pre className="p-2 rounded bg-muted/60 max-h-32 overflow-auto font-mono text-[11px]">
                {JSON.stringify(selectedStep.output, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground italic">No output artifacts generated yet.</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
