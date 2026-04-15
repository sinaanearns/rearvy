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
  MEMORIES: "memories",
  INSIGHTS: "insights",
  WHISPERNET_WATCHERS: "whispernet_watchers",
  WHISPERNET_CONTENT_ITEMS: "whispernet_content_items",
  WHISPERNET_MENTIONS: "whispernet_mentions",
  WHISPERNET_FORECASTS: "whispernet_forecasts",
  WHISPERNET_ALERTS: "whispernet_alerts",
  WHISPERNET_PROCESSING_JOBS: "whispernet_processing_jobs",

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
  onboarding_completed: boolean;
  timezone: string;
  currency: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Chat {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string | null;
  parent_chat_id: string | null;
  fork_point_message_id: string | null;
  is_archived: boolean;
  is_pinned?: boolean;
  participant_ids?: string[];
  chat_type?: string | null;
  chat_scope?: string | null;
  user_facing_title?: string | null;
  admin_participant_ids?: string[];
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
    | "gmail";
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
