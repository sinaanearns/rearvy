export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  business_name: string | null;
  business_type: "shopify" | "content_creator" | "agency" | "other" | null;
  onboarding_completed: boolean;
  timezone: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  settings: Record<string, unknown>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: "launch" | "campaign" | "strategy" | "analysis" | "custom";
  icon: string | null;
  starter_prompts: { label: string; prompt: string }[];
  default_tools: string[];
  system_prompt_addon: string | null;
  is_active: boolean;
  created_at: string;
};

export type Chat = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string | null;
  parent_chat_id: string | null;
  fork_point_message_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type Message = {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string | null;
  parts: unknown[] | null;
  tool_invocations: unknown[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IntegrationProvider =
  | "shopify"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "stripe"
  | "google_analytics";

export type IntegrationStatus = "active" | "expired" | "revoked" | "error";

export type Integration = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  provider_account_id: string | null;
  provider_account_name: string | null;
  scopes: string[];
  token_expires_at: string | null;
  status: IntegrationStatus;
  last_synced_at: string | null;
  sync_cursor: unknown;
  created_at: string;
  updated_at: string;
};

export type MetricType =
  | "revenue"
  | "orders"
  | "units_sold"
  | "refunds"
  | "page_views"
  | "sessions"
  | "bounce_rate"
  | "conversion_rate"
  | "followers"
  | "subscribers"
  | "likes"
  | "comments"
  | "shares"
  | "video_views"
  | "impressions"
  | "reach"
  | "engagement_rate"
  | "average_order_value"
  | "customer_count"
  | "repeat_customer_rate";

export type BusinessMetric = {
  id: string;
  user_id: string;
  integration_id: string | null;
  metric_type: MetricType;
  metric_value: number;
  dimensions: Record<string, unknown>;
  period_start: string;
  period_end: string;
  granularity: "hourly" | "daily" | "weekly" | "monthly";
  created_at: string;
};

export type Product = {
  id: string;
  user_id: string;
  integration_id: string | null;
  external_id: string | null;
  title: string;
  description: string | null;
  price: number | null;
  compare_at_price: number | null;
  currency: string;
  inventory_quantity: number | null;
  status: "active" | "draft" | "archived";
  product_type: string | null;
  vendor: string | null;
  tags: string[];
  image_url: string | null;
  handle: string | null;
  variants_count: number;
  metadata: Record<string, unknown>;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
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
  placed_at: string;
  created_at: string;
};

export type MemoryType =
  | "fact"
  | "preference"
  | "goal"
  | "decision"
  | "context"
  | "persona";

export type Memory = {
  id: string;
  user_id: string;
  project_id: string | null;
  content: string;
  memory_type: MemoryType;
  importance: number;
  source_message_id: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InsightType =
  | "anomaly"
  | "trend"
  | "milestone"
  | "opportunity"
  | "risk"
  | "sync_event";

export type InsightSeverity = "info" | "notable" | "important" | "critical";

export type Insight = {
  id: string;
  user_id: string;
  insight_type: InsightType;
  severity: InsightSeverity;
  title: string;
  summary: string;
  data_snapshot: Record<string, unknown>;
  metric_refs: unknown[];
  related_entity: { type: string; id: string } | null;
  is_read: boolean;
  is_dismissed: boolean;
  generated_at: string;
  expires_at: string | null;
  created_at: string;
};
