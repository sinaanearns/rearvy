import type { SubscriptionPlan } from "@/lib/plans";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username?: string | null;
  bio?: string | null;
  working_on?: string | null;
  skills?: string[] | null;
  project_links?: string[] | null;
  business_name: string | null;
  business_type: "shopify" | "content_creator" | "agency" | "other" | null;
  plan: SubscriptionPlan;
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
  is_pinned?: boolean;
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
  | "stripe"
  | "google_analytics"
  | "website"
  | "github"
  | "razorpay"
  | "excel";

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

export type RazorpayPayment = {
  id: string;
  user_id: string;
  integration_id: string | null;
  payment_id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status:
    | "created"
    | "authorized"
    | "captured"
    | "refunded"
    | "failed"
    | null;
  method: string | null;
  amount_refunded: number;
  description: string | null;
  notes: Record<string, unknown>;
  vpa: string | null;
  bank: string | null;
  wallet: string | null;
  captured_at: string | null;
  created_at_source: string;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type YouTubeChannel = {
  id: string;
  user_id: string;
  integration_id: string;
  channel_id: string;
  title: string;
  description: string | null;
  custom_url: string | null;
  thumbnail_url: string | null;
  country: string | null;
  published_at: string | null;
  subscriber_count: number;
  video_count: number;
  view_count: number;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type YouTubeVideo = {
  id: string;
  user_id: string;
  integration_id: string;
  channel_id: string;
  video_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration: string | null;
  tags: string[];
  category_id: string | null;
  privacy_status: "public" | "private" | "unlisted" | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  favorite_count: number;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type YouTubeComment = {
  id: string;
  user_id: string;
  integration_id: string;
  video_id: string;
  comment_id: string;
  parent_comment_id: string | null;
  author_name: string | null;
  author_channel_id: string | null;
  author_image_url: string | null;
  text_display: string;
  like_count: number;
  reply_count: number;
  published_at: string | null;
  updated_at_yt: string | null;
  synced_at: string | null;
  created_at: string;
};

export type YouTubeAnalytics = {
  id: string;
  user_id: string;
  integration_id: string;
  channel_id: string;
  metric_date: string;
  views: number;
  estimated_minutes_watched: number;
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  average_view_duration: number;
  impressions: number;
  impressions_ctr: number;
  synced_at: string | null;
  created_at: string;
};

export type InstagramAccount = {
  id: string;
  user_id: string;
  integration_id: string;
  instagram_id: string;
  username: string;
  name: string | null;
  profile_picture_url: string | null;
  biography: string | null;
  website: string | null;
  followers_count: number;
  follows_count: number;
  media_count: number;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InstagramPost = {
  id: string;
  user_id: string;
  integration_id: string;
  post_id: string;
  caption: string | null;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  published_at: string | null;
  like_count: number;
  comments_count: number;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  saved: number | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InstagramComment = {
  id: string;
  user_id: string;
  integration_id: string;
  post_id: string;
  comment_id: string;
  text: string;
  username: string | null;
  published_at: string | null;
  like_count: number;
  synced_at: string | null;
  created_at: string;
};

export type InstagramAnalytics = {
  id: string;
  user_id: string;
  integration_id: string;
  metric_date: string;
  follower_count: number | null;
  impressions: number | null;
  reach: number | null;
  profile_views: number | null;
  synced_at: string | null;
  created_at: string;
};

export type ProductReview = {
  id: string;
  user_id: string;
  integration_id: string | null;
  product_id: string | null;
  external_review_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string | null;
  author_email: string | null;
  verified_purchase: boolean;
  source: string;
  sentiment: string | null;
  created_at_source: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
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

export type Website = {
  id: string;
  user_id: string;
  site_id: string;
  domain: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WebsiteSession = {
  id: string;
  website_id: string;
  user_id: string;
  visitor_id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number;
  page_count: number;
  entry_page: string | null;
  exit_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  country: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  screen_width: number | null;
  screen_height: number | null;
  created_at: string;
};

export type WebsitePageview = {
  id: string;
  website_id: string;
  user_id: string;
  session_id: string;
  visitor_id: string;
  url: string;
  path: string;
  title: string | null;
  referrer: string | null;
  duration_ms: number;
  scroll_depth: number;
  timestamp: string;
  created_at: string;
};

export type WebsiteEvent = {
  id: string;
  website_id: string;
  user_id: string;
  session_id: string;
  visitor_id: string;
  event_type: "click" | "scroll" | "custom";
  event_name: string | null;
  properties: Record<string, unknown>;
  url: string | null;
  timestamp: string;
  created_at: string;
};

export type WhisperNetWatcher = {
  id: string;
  user_id: string;
  product_id: string;
  product_title: string;
  product_handle: string | null;
  aliases: string[];
  required_keywords: string[];
  excluded_phrases: string[];
  fuzzy_match: boolean;
  enabled: boolean;
  low_inventory_threshold: number;
  last_scanned_at: string | null;
  last_match_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhisperNetContentItem = {
  id: string;
  user_id: string;
  integration_id: string | null;
  platform: "youtube" | "instagram";
  content_type: "video" | "post";
  source_id: string;
  creator_name: string | null;
  title: string | null;
  description: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  transcript_status: "available" | "pending" | "unavailable";
  transcript_text: string | null;
  published_at: string | null;
  metrics: Record<string, number | null>;
  synced_at: string | null;
  last_processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhisperNetMention = {
  id: string;
  user_id: string;
  watcher_id: string;
  product_id: string;
  content_item_id: string;
  platform: "youtube" | "instagram";
  source_id: string;
  detection_source: "title" | "description" | "caption" | "transcript" | "comment";
  matched_phrase: string;
  matched_text: string;
  context_window: string;
  mention_timestamp_seconds: number | null;
  confidence: number;
  fuzzy_match: boolean;
  mention_key: string;
  source_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhisperNetForecast = {
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
  created_at: string;
  updated_at: string;
};

export type WhisperNetAlert = {
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
  source_url: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type WhisperNetProcessingJob = {
  id: string;
  user_id: string;
  status: "running" | "succeeded" | "failed";
  trigger: "manual" | "sync" | "internal";
  stats: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};
