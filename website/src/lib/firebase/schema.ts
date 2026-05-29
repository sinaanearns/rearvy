import type { SubscriptionPlan } from "@/lib/plans";

/**
 * Firestore Collections Schema
 * 
 * This defines the Firestore collection structure that mirrors the PostgreSQL schema.
 */

export const COLLECTIONS = {
  // User profiles
  PROFILES: "profiles",

  // Projects
  PROJECTS: "projects",
  PROJECT_TEMPLATES: "project_templates",

  // Chats and Messages
  CHATS: "chats",
  MESSAGES: "messages",

  // Integrations
  INTEGRATIONS: "integrations",
  INTEGRATION_SYNC_JOBS: "integration_sync_jobs",
  EXCEL_WORKBOOKS: "excel_workbooks",
  EXCEL_ROWS: "excel_rows",
  GITHUB_REPOS: "github_repos",
  GITHUB_ISSUES: "github_issues",
  GITHUB_PULL_REQUESTS: "github_pull_requests",
  BROWSER_CREDENTIALS: "browser_credentials",

  // Business Metrics
  BUSINESS_METRICS: "business_metrics",

  // E-commerce data
  PRODUCTS: "products",
  ORDERS: "orders",
  RAZORPAY_PAYMENTS: "razorpay_payments",
  PRODUCT_REVIEWS: "product_reviews",

  // YouTube data
  YOUTUBE_CHANNELS: "youtube_channels",
  YOUTUBE_VIDEOS: "youtube_videos",
  YOUTUBE_COMMENTS: "youtube_comments",
  YOUTUBE_ANALYTICS: "youtube_analytics",

  // Instagram data
  INSTAGRAM_ACCOUNTS: "instagram_accounts",
  INSTAGRAM_POSTS: "instagram_posts",
  INSTAGRAM_COMMENTS: "instagram_comments",
  INSTAGRAM_ANALYTICS: "instagram_analytics",

  // Facebook data
  FACEBOOK_PAGES: "facebook_pages",
  FACEBOOK_POSTS: "facebook_posts",
  FACEBOOK_COMMENTS: "facebook_comments",
  FACEBOOK_ANALYTICS: "facebook_analytics",

  // Website tracking
  WEBSITES: "websites",
  WEBSITE_SESSIONS: "website_sessions",
  WEBSITE_PAGEVIEWS: "website_pageviews",
  WEBSITE_EVENTS: "website_events",

  // AI Features
  WORK_AGENTS: "work_agents",
  WORK_AGENT_SKILLS: "work_agent_skills",
  WORK_AGENT_TEAMS: "work_agent_teams",
  WORK_TEAM_MEMBERS: "work_team_members",
  WORK_TASKS: "work_tasks",
  WORK_LISTENERS: "work_listeners",
  WORK_SCHEDULED_AUTOMATIONS: "work_scheduled_automations",
  WORK_AUTOMATION_RUNS: "work_automation_runs",
  WORK_CHANNEL_CONNECTIONS: "work_channel_connections",
  WORK_CHANNEL_MESSAGES: "work_channel_messages",
  WORK_PAIRED_DEVICES: "work_paired_devices",
  WORK_PAIRING_TOKENS: "work_pairing_tokens",
  WORK_LOCAL_JOBS: "work_local_jobs",
  WORK_PROCESS_SESSIONS: "work_process_sessions",
  WORK_ARTIFACTS: "work_artifacts",
  WORK_SOURCE_TASKS: "work_source_tasks",
  WORK_SOURCE_CANDIDATES: "work_source_candidates",
  WORK_TEAM_RUNS: "work_team_runs",
  WORK_TEAM_MEMBER_RUNS: "work_team_member_runs",
  WORK_SCHEDULER_LEASES: "work_scheduler_leases",
  WORK_DIARY_ENTRIES: "work_diary_entries",
  MEMORIES: "memories",
  INSIGHTS: "insights",
  ASSISTANT_ALERTS: "assistant_alerts",

  // Maria voice dictation
  MARIA_VOICE_PROFILES: "maria_voice_profiles",
  MARIA_VOICE_DICTIONARY: "maria_voice_dictionary",
  MARIA_VOICE_SNIPPETS: "maria_voice_snippets",
  MARIA_VOICE_STYLES: "maria_voice_styles",
  MARIA_VOICE_TEAMS: "maria_voice_teams",
  MARIA_VOICE_TEAM_MEMBERS: "maria_voice_team_members",
  MARIA_VOICE_TEAM_INVITES: "maria_voice_team_invites",
  MARIA_VOICE_USAGE_EVENTS: "maria_voice_usage_events",

  AGENT_EVENTS: "agent_events",
  AGENT_RUNS: "agent_runs",
  AUTOMATION_POLICIES: "automation_policies",
  AI_PROVIDER_EVENTS: "ai_provider_events",
  AI_USAGE_EVENTS: "ai_usage_events",
  AI_PROVIDER_SETTINGS: "ai_provider_settings",
  TRANSACTION_REQUESTS: "transaction_requests",
  BUSINESS_METRIC_SNAPSHOTS: "business_metric_snapshots",
  WHISPERNET_WATCHERS: "whispernet_watchers",
  WHISPERNET_CONTENT_ITEMS: "whispernet_content_items",
  WHISPERNET_MENTIONS: "whispernet_mentions",
  WHISPERNET_FORECASTS: "whispernet_forecasts",
  WHISPERNET_ALERTS: "whispernet_alerts",
  WHISPERNET_PROCESSING_JOBS: "whispernet_processing_jobs",
  PYTHON_SANDBOX_SCRIPTS: "python_sandbox_scripts",
  PYTHON_SANDBOX_RUNS: "python_sandbox_runs",

  // Gmail data
  GMAIL_MESSAGES: "gmail_messages",
  GMAIL_THREADS: "gmail_threads",

  // Product feedback
  FEEDBACK_SUBMISSIONS: "feedback_submissions",
  PROFILE_FOLLOW_REQUESTS: "profile_follow_requests",

  // Chat requests
  CHAT_REQUESTS: "chat_requests",

  // Verified trader signal tracking
  TRADER_SIGNALS: "trader_signals",

  // LinkedIn data
  LINKEDIN_PROFILES: "linkedin_profiles",
  LINKEDIN_POSTS: "linkedin_posts",
  LINKEDIN_COMMENTS: "linkedin_comments",

  // MCP Servers
  MCP_SERVERS: "mcp_servers",
} as const;

/**
 * Firestore Document Types (matching database.ts)
 */

export interface Profile {
  id: string; // same as user uid
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  business_name: string | null;
  business_type: "shopify" | "content_creator" | "agency" | "other" | null;
  plan: SubscriptionPlan;
  credits: number;
  onboarding_completed: boolean;
  timezone: string;
  currency: string;
  metamask_address?: string | null;
  metamask_chain_id?: string | null;
  metamask_network?: string | null;
  metamask_eth_balance?: number | null;
  metamask_eur_balance?: number | null;
  metamask_last_synced_at?: string | null;
  execution_budget_eur?: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Chat {
  id: string;
  user_id: string;
  project_id: string | null;
  agent_id?: string | null;
  title: string | null;
  parent_chat_id: string | null;
  fork_point_message_id: string | null;
  is_archived: boolean;
  is_pinned?: boolean;
  participant_ids?: string[];
  chat_type?: string | null;
  chat_scope?: string | null;
  user_facing_title?: string | null;
  system_chat_type?: string | null;
  is_group?: boolean;
  invite_code?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  sender_id?: string | null;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    url: string;
    storagePath: string;
    kind: "image" | "file";
  }> | null;
  parts: unknown[] | null;
  tool_invocations: unknown[] | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
}

export interface AssistantAlert {
  id: string;
  user_id: string;
  chat_id: string | null;
  project_id: string | null;
  message_id: string | null;
  title: string;
  summary: string;
  message_text: string;
  severity: "info" | "warning" | "success";
  source: string;
  is_read: boolean;
  read_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

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

export interface AgentEvent {
  id: string;
  user_id: string;
  project_id: string | null;
  type: AgentEventType;
  source: string;
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
}

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_approval";

export interface AgentRun {
  id: string;
  user_id: string;
  project_id: string | null;
  event_id: string;
  trigger_type: AgentEventType;
  status: AgentRunStatus;
  model_route: Record<string, unknown> | null;
  tools_used: string[];
  approval_state: "not_required" | "required" | "approved" | "rejected";
  output: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationPolicy {
  id: string;
  user_id: string;
  project_id: string | null;
  layer: 1 | 2 | 3 | 4;
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
}

export type TransactionRequestStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "submitted"
  | "failed";

export interface TransactionRequest {
  id: string;
  user_id: string;
  chat_id: string | null;
  project_id: string | null;
  agent_run_id: string | null;
  source: "ai_suggestion" | "manual" | "user_action" | "operations_console";
  type: "native_evm_transfer";
  status: TransactionRequestStatus;
  from_address: string | null;
  to_address: string;
  chain_id: string | null;
  network_name: string | null;
  native_symbol: "ETH";
  amount_eth: string;
  amount_wei: string;
  human_amount: string;
  amount_display: string;
  reason: string;
  risk_summary: string;
  approval_required: true;
  approved_at: string | null;
  approved_by: string | null;
  wallet_use_approved_at: string | null;
  wallet_use_approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  submitted_at: string | null;
  tx_hash: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessMetricSnapshot {
  id: string;
  user_id: string;
  project_id: string | null;
  source: string;
  metrics: Record<string, number | string | null>;
  previous_metrics: Record<string, number | string | null> | null;
  change_summary: string | null;
  created_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider:
    | "shopify"
    | "youtube"
    | "instagram"
    | "stripe"
    | "google_analytics"
    | "website"
    | "github"
    | "facebook"
    | "razorpay"
    | "excel"
    | "gmail"
    | "linkedin"
    | "whatsapp"
    | "crm"
    | "browser"
    | "filesystem";
  provider_account_id: string | null;
  provider_account_name: string | null;
  access_token_enc: string;
  refresh_token_enc?: string;
  token_iv: string;
  scopes: string[];
  token_expires_at: Date | string | null;
  status: "active" | "expired" | "revoked" | "error";
  last_synced_at: Date | string | null;
  sync_cursor: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BrowserCredential {
  id: string;
  user_id: string;
  project_id: string | null;
  service: string;
  label: string;
  label_lower: string;
  login_enc: string;
  login_iv: string;
  password_enc: string;
  password_iv: string;
  notes?: string | null;
  is_persistent: boolean;
  is_active: boolean;
  memory_id?: string | null;
  last_used_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export type PythonSandboxApprovalState = "draft" | "approved" | "archived";

export type PythonSandboxRunStatus =
  | "queued"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export type PythonSandboxRiskLevel = "low" | "medium" | "high";

export interface PythonSandboxScript {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  code: string;
  language: "python";
  entrypoint: string | null;
  version: number;
  approval_state: PythonSandboxApprovalState;
  allowed_data_scopes: string[];
  allow_network: boolean;
  max_runtime_seconds: number;
  max_memory_mb: number;
  created_by: string | null;
  last_run_at: string | null;
  last_run_status: PythonSandboxRunStatus | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PythonSandboxRunArtifact {
  name: string;
  path: string;
  content_type: string | null;
  size_bytes: number | null;
}

export interface PythonSandboxRun {
  id: string;
  user_id: string;
  script_id: string | null;
  script_name: string | null;
  source: "script" | "adhoc";
  code: string;
  input: Record<string, unknown>;
  status: PythonSandboxRunStatus;
  approval_required: boolean;
  risk_level: PythonSandboxRiskLevel;
  allow_network: boolean;
  max_runtime_seconds: number;
  max_memory_mb: number;
  allowed_data_scopes: string[];
  requested_by: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  result: unknown | null;
  error: string | null;
  stdout: string[];
  stderr: string[];
  artifacts: PythonSandboxRunArtifact[];
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  integration_id: string | null;
  external_id: string | null;
  order_number: string | null;
  total_price: number;
  subtotal_price: number | null;
  total_tax: number;
  total_discount: number;
  shipping_cost: number;
  currency: string;
  financial_status:
    | "pending"
    | "paid"
    | "partially_paid"
    | "refunded"
    | "partially_refunded"
    | "voided"
    | null;
  fulfillment_status:
    | "unfulfilled"
    | "partial"
    | "fulfilled"
    | "restocked"
    | null;
  customer_email: string | null;
  customer_name: string | null;
  line_items: unknown[];
  tags: string[];
  placed_at: Date | string;
  created_at: Date | string;
}

export interface FeedbackSubmission {
  id: string;
  user_id: string;
  user_email: string | null;
  type: "issue" | "feature";
  message: string;
  page: string;
  status: "open" | "reviewing" | "closed";
  created_at: Date | string;
  updated_at: Date | string;
}

export interface RazorpayPayment {
  id: string;
  user_id: string;
  integration_id: string | null;
  payment_id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed" | null;
  method: string | null;
  amount_refunded: number;
  description: string | null;
  notes: Record<string, unknown>;
  vpa: string | null;
  bank: string | null;
  wallet: string | null;
  captured_at: Date | string | null;
  created_at_source: Date | string;
  synced_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WhisperNetWatcher {
  id: string;
  user_id: string;
  product_id: string;
  product_title: string;
  product_handle?: string | null;
  aliases: string[];
  required_keywords: string[];
  excluded_phrases: string[];
  fuzzy_match: boolean;
  enabled: boolean;
  low_inventory_threshold: number;
  last_scanned_at?: Date | string | null;
  last_match_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WhisperNetContentItem {
  id: string;
  user_id: string;
  integration_id?: string | null;
  platform: "youtube" | "instagram";
  content_type: "video" | "post";
  source_id: string;
  creator_name?: string | null;
  title?: string | null;
  description?: string | null;
  caption?: string | null;
  permalink?: string | null;
  thumbnail_url?: string | null;
  transcript_status: "available" | "pending" | "unavailable";
  transcript_text?: string | null;
  published_at?: Date | string | null;
  metrics: Record<string, number | null>;
  synced_at?: Date | string | null;
  last_processed_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WhisperNetMention {
  id: string;
  user_id: string;
  watcher_id: string;
  product_id: string;
  content_item_id: string;
  platform: "youtube" | "instagram";
  source_id: string;
  detection_source:
    | "title"
    | "description"
    | "caption"
    | "transcript"
    | "comment";
  matched_phrase: string;
  matched_text: string;
  context_window: string;
  mention_timestamp_seconds?: number | null;
  confidence: number;
  fuzzy_match: boolean;
  mention_key: string;
  source_url?: string | null;
  published_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WhisperNetForecast {
  id: string;
  user_id: string;
  mention_id: string;
  product_id: string;
  content_item_id: string;
  predicted_incremental_units_48h: number;
  predicted_incremental_revenue_48h: number;
  baseline_units_48h: number;
  confidence: "low" | "medium" | "high";
  confidence_score: number;
  confidence_band: {
    lower_units: number;
    upper_units: number;
    lower_revenue: number;
    upper_revenue: number;
  };
  inventory_snapshot: {
    inventory_available: number | null;
    low_inventory_threshold: number;
  };
  projected_total_units_48h: number;
  estimated_hours_until_stockout: number | null;
  stockout_risk: "low" | "medium" | "high" | "critical";
  rationale: string[];
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WhisperNetAlert {
  id: string;
  user_id: string;
  product_id: string;
  forecast_id: string;
  mention_id: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "dismissed" | "resolved";
  title: string;
  summary: string;
  recommended_action: string;
  source_url?: string | null;
  payload: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
  resolved_at?: Date | string | null;
}

export interface WhisperNetProcessingJob {
  id: string;
  user_id: string;
  status: "running" | "succeeded" | "failed";
  trigger: "manual" | "sync" | "internal";
  stats?: Record<string, unknown>;
  error?: string | null;
  started_at: Date | string;
  finished_at?: Date | string | null;
}

export type GmailMessage = {
  id: string;
  user_id: string;
  integration_id: string;
  external_id: string;
  thread_id: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string | null;
  body_text: string | null;
  received_at: Date | string;
  
  // Classification
  category: "pre_sale" | "support" | "order_update" | "complaint" | "other" | null;
  intent_signals: string[];
  sentiment: "positive" | "neutral" | "negative" | null;
  
  // Attribution
  order_id: string | null;
  customer_id: string | null;
  
  processed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface GmailThread {
  id: string;
  user_id: string;
  integration_id: string;
  external_id: string;
  last_message_at: Date | string;
  message_count: number;
  snippet: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface McpServerConfig {
  id: string;
  user_id: string;
  name: string;
  type: "stdio" | "sse";
  command?: string; // for stdio
  args?: string[]; // for stdio
  env?: Record<string, string>; // for stdio
  url?: string; // for sse
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export type WorkAgentCapabilityPreset =
  | "standard"
  | "full"
  | "minimal"
  | "team_lead";

export interface WorkAgent {
  id: string;
  user_id: string;
  name: string;
  short_label: string;
  summary: string;
  role: string;
  instructions: string;
  system_prompt: string;
  model_id: string | null;
  capability_preset: WorkAgentCapabilityPreset;
  workspace_scope: {
    mode: "none" | "project" | "folder";
    project_id: string | null;
    path: string | null;
  };
  installed_skill_ids: string[];
  memory_enabled: boolean;
  visibility: "private" | "team";
  source: "built_in" | "custom";
  built_in_key: string | null;
  performance_score?: number | null;
  quality_status?: "unknown" | "healthy" | "watch" | "low_score" | "archived";
  last_evaluated_at?: string | null;
  low_score_streak?: number;
  archive_reason?: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkAgentSkill {
  id: string;
  user_id: string;
  agent_id: string | null;
  skill_id: string;
  name: string;
  description: string;
  scope: "account" | "agent";
  source: "built_in" | "mcp";
  mcp_server_id: string | null;
  is_enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkAgentTeam {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  lead_agent_id: string;
  project_id: string | null;
  workspace_path: string | null;
  mode: "coordinator" | "parallel" | "review";
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkTeamMember {
  id: string;
  user_id: string;
  team_id: string;
  agent_id: string;
  role: "lead" | "member";
  created_at: Date | string;
}

export type WorkTrustedScope = "none" | "read_only" | "trusted";

export interface WorkTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "archived";
  priority: "low" | "normal" | "high";
  project_id: string | null;
  agent_id: string | null;
  due_at: string | null;
  tags: string[];
  source: "manual" | "automation" | "listener";
  completed_at: string | null;
  archived_at: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkListener {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  provider: "gmail" | "channel" | "source" | "webhook";
  query: string;
  status: "active" | "paused" | "error" | "archived";
  schedule: string;
  schedule_label: string;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_match_at: string | null;
  match_count: number;
  auto_execute_enabled: boolean;
  trusted_scope: WorkTrustedScope;
  last_auto_executed_at: string | null;
  action: "notify" | "create_task" | "run_source" | "sync_gmail" | "enqueue_event";
  config: Record<string, unknown>;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkScheduledAutomation {
  id: string;
  user_id: string;
  agent_id: string | null;
  team_id: string | null;
  project_id: string | null;
  name: string;
  description: string | null;
  task: string;
  schedule: string;
  schedule_label: string;
  timezone: string;
  run_target: "agent" | "team" | "browser" | "python" | "sync";
  approval_required: boolean;
  auto_execute_enabled?: boolean;
  trusted_scope?: WorkTrustedScope;
  last_auto_executed_at?: string | null;
  is_enabled: boolean;
  built_in_key?: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkAutomationRun {
  id: string;
  user_id: string;
  automation_id: string | null;
  agent_event_id: string | null;
  status: "queued" | "awaiting_approval" | "running" | "completed" | "failed" | "canceled";
  trigger: "manual" | "schedule" | "chat";
  run_target?: "agent" | "team" | "browser" | "python" | "sync" | "channel" | "source";
  agent_id?: string | null;
  team_id?: string | null;
  project_id?: string | null;
  approval_state?: "not_required" | "required" | "approved" | "rejected";
  task: string;
  output: Record<string, unknown> | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkChannelConnection {
  id: string;
  user_id: string;
  provider: WorkChannelProvider;
  label: string;
  status: "planned" | "configured" | "active" | "error";
  agent_id: string | null;
  team_id: string | null;
  external_channel_id?: string | null;
  config?: Record<string, unknown>;
  credential_enc?: string | null;
  credential_iv?: string | null;
  credential_hint?: Record<string, string>;
  auto_reply_enabled?: boolean;
  trusted_scope?: WorkTrustedScope;
  last_auto_executed_at?: string | null;
  last_health?: Record<string, unknown> | null;
  last_message_at?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export type WorkChannelProvider =
  | "telegram"
  | "discord"
  | "slack"
  | "whatsapp"
  | "wechat"
  | "dingtalk"
  | "lark";

export interface WorkChannelMessage {
  id: string;
  user_id: string;
  connection_id: string | null;
  provider: WorkChannelProvider;
  direction: "inbound" | "outbound";
  external_message_id: string | null;
  external_channel_id: string | null;
  sender_id: string | null;
  text: string | null;
  payload: Record<string, unknown>;
  status: "received" | "queued" | "sent" | "failed";
  error: string | null;
  agent_event_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkPairedDevice {
  id: string;
  user_id: string;
  device_name: string;
  device_type: "desktop" | "browser" | "mobile" | "unknown";
  status: "active" | "inactive" | "revoked";
  last_seen_at: string | null;
  pairing_token_id?: string | null;
  capabilities?: string[];
  local_runtime?: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkPairingToken {
  id: string;
  user_id: string;
  code_hash: string;
  label: string;
  status: "pending" | "claimed" | "expired" | "revoked";
  claimed_device_id: string | null;
  expires_at: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkLocalJob {
  id: string;
  user_id: string;
  device_id: string | null;
  run_id: string | null;
  job_type: "desktop_workflow" | "browser_session" | "terminal" | "healthcheck";
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  claimed_at: string | null;
  finished_at: string | null;
}

export interface WorkProcessSession {
  id: string;
  user_id: string;
  device_id: string | null;
  command: string;
  cwd: string | null;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  auto_execute_enabled: boolean;
  trusted_scope: WorkTrustedScope;
  last_auto_executed_at: string | null;
  stdout: string[];
  stderr: string[];
  exit_code: number | null;
  local_job_id: string | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkArtifact {
  id: string;
  user_id: string;
  chat_id: string | null;
  agent_id: string | null;
  team_id: string | null;
  title: string;
  artifact_type:
    | "report"
    | "table"
    | "document"
    | "automation_log"
    | "browser_capture"
    | "channel_message"
    | "source_research"
    | "team_output";
  payload: Record<string, unknown>;
  run_id?: string | null;
  source_task_id?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export type WorkSourceProvider =
  | "reddit"
  | "tiktok"
  | "alibaba"
  | "aliexpress"
  | "1688"
  | "shopify"
  | "youtube"
  | "instagram"
  | "facebook"
  | "github"
  | "web";

export interface WorkSourceTask {
  id: string;
  user_id: string;
  provider: WorkSourceProvider;
  query: string;
  status: "draft" | "awaiting_approval" | "queued" | "running" | "completed" | "failed" | "canceled";
  mode: "official_api" | "browser_fallback" | "existing_rearvy_data";
  approval_required: boolean;
  auto_execute_enabled?: boolean;
  trusted_scope?: WorkTrustedScope;
  last_auto_executed_at?: string | null;
  agent_id: string | null;
  team_id: string | null;
  run_id: string | null;
  output: Record<string, unknown> | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkSourceCandidate {
  id: string;
  user_id: string;
  task_id: string;
  provider: WorkSourceProvider;
  title: string;
  url: string | null;
  summary: string | null;
  score: number;
  evidence: Array<{ label: string; url: string | null; snippet: string | null }>;
  price?: string | null;
  moq?: string | null;
  supplier?: string | null;
  payload: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkDiaryEntry {
  id: string;
  user_id: string;
  entry_date: string;
  title: string;
  summary: string;
  highlights: string[];
  metrics: Record<string, number>;
  source_ids: string[];
  visibility: "private";
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkTeamRun {
  id: string;
  user_id: string;
  team_id: string;
  task: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  lead_agent_id: string | null;
  output: Record<string, unknown> | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkTeamMemberRun {
  id: string;
  user_id: string;
  team_run_id: string;
  team_id: string;
  agent_id: string;
  role: "lead" | "member";
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  task: string;
  output: Record<string, unknown> | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkSchedulerLease {
  id: string;
  owner_id: string;
  status: "active" | "expired";
  expires_at: string;
  created_at: Date | string;
  updated_at: Date | string;
}
