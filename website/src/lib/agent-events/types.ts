import type { ModelRouteDecision } from "@/lib/ai/model-router";

export type AgentEventSource =
  | "user_request"
  | "webhook"
  | "schedule"
  | "anomaly_detector"
  | "metric_monitor"
  | "automation_policy";

export type AgentEventType =
  | "user_request"
  | "webhook"
  | "schedule"
  | "anomaly"
  | "metric_change"
  | "automation_trigger";

export type AgentEventStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "canceled";

export type AutomationApprovalState =
  | "not_required"
  | "required"
  | "approved"
  | "rejected";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_approval";

export type AutomationLayer = 1 | 2 | 3 | 4;

export type AgentEvent = {
  id: string;
  user_id: string;
  project_id: string | null;
  type: AgentEventType;
  source: AgentEventSource;
  dedupe_key: string | null;
  priority: number;
  status: AgentEventStatus;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  next_run_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRun = {
  id: string;
  user_id: string;
  project_id: string | null;
  event_id: string;
  trigger_type: AgentEventType;
  status: AgentRunStatus;
  model_route: ModelRouteDecision | Record<string, unknown> | null;
  tools_used: string[];
  approval_state: AutomationApprovalState;
  output: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationPolicy = {
  id: string;
  user_id: string;
  project_id: string | null;
  layer: AutomationLayer;
  allowed_scopes: string[];
  require_approval_for: string[];
  desktop_permissions: {
    filesystem: boolean;
    appControl: boolean;
    browserControl: boolean;
    shellCommands: boolean;
  };
  rate_limits: {
    maxRunsPerHour: number;
    maxActionsPerRun: number;
  };
  audit_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessMemory = {
  id: string;
  user_id: string;
  project_id: string | null;
  memory_type:
    | "business_context"
    | "preference"
    | "past_action"
    | "workflow_outcome"
    | "operational_history"
    | "growth_insight";
  content: string;
  source: string;
  confidence: number;
  tags: string[];
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessMetricSnapshot = {
  id: string;
  user_id: string;
  project_id: string | null;
  source: string;
  metrics: Record<string, number | string | null>;
  previous_metrics: Record<string, number | string | null> | null;
  change_summary: string | null;
  created_at: string;
};

export type ConnectorAdapter = {
  id: string;
  provider:
    | "shopify"
    | "razorpay"
    | "stripe"
    | "gmail"
    | "whatsapp"
    | "google_analytics"
    | "github"
    | "excel"
    | "crm"
    | "browser"
    | "filesystem";
  connect: string;
  sync: string;
  webhookNormalize: string;
  metricExtraction: string;
  toolRegistry: string[];
  disconnect: string;
};
